#!/usr/bin/env python3
"""Fail closed if the reviewed Node build image or install policy changes."""

from pathlib import Path
import re
import sys

NODE_FROM = (
    "node:22.23.4-alpine3.24@sha256:"
    "fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914 AS build"
)
FINAL_FROM = "nginxinc/nginx-unprivileged:stable-alpine"
NPM_VERSION = "11.10.0"
NPM_SRI = (
    "sha512-i8hE43iSIAMFuYVi8TxsEISdELM4fIza600aLjJ0ankGPLqd0oTPKMJqAcO/QWm307MbSlWGzJcNZ0lGMQgHPA=="
)
COMPOSE_NAMES = {
    "compose.yml",
    "compose.yaml",
    "docker-compose.yml",
    "docker-compose.yaml",
}
NPM_BOOTSTRAP = "scripts/install-pinned-npm.sh"
EXPECTED_DOCKERIGNORE = [".gitignore", "LICENSE", "README.md"]


def dockerfile_instructions(text: str) -> list[tuple[str, str]]:
    """Return non-comment Dockerfile instructions, joining continuations."""
    result = []
    pending = ""
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if pending:
            line = pending + line
        if line.endswith("\\"):
            pending = line[:-1].rstrip() + " "
            continue
        pending = ""
        match = re.match(r"([A-Za-z]+)\s+(.*)$", line)
        if not match:
            return []
        result.append((match.group(1).upper(), " ".join(match.group(2).split())))
    if pending:
        return []
    return result


def validate_dockerfile(text: str) -> list[str]:
    instructions = dockerfile_instructions(text)
    stages: list[list[tuple[str, str]]] = []
    for instruction in instructions:
        if instruction[0] == "FROM":
            stages.append([instruction])
        elif stages:
            stages[-1].append(instruction)
    froms = [stage[0][1] for stage in stages]
    expected_froms = [NODE_FROM.lower(), FINAL_FROM.lower()]
    if [value.lower() for value in froms] != expected_froms:
        return [f"FROM selection mismatch: {froms!r}"]

    build = stages[0]
    final = stages[1]
    expected_build = [
        ("ARG", "REACT_APP_SERVICES_HOST=/services/m"),
        ("WORKDIR", "/app/src"),
        ("COPY", ". /app"),
        ("RUN", "sh /app/scripts/install-pinned-npm.sh"),
        ("RUN", "npm install"),
        ("RUN", "npm run build"),
    ]
    build_body = build[1:]
    if build_body != expected_build:
        return [
            "Build-stage instructions must exactly copy the source once, verify npm, "
            "install dependencies, and build in the reviewed order; "
            f"found {build_body!r}"
        ]
    if final[1:] != [("COPY", "--from=build /app/dist /usr/share/nginx/html"),
                    ("USER", "nginx")]:
        return [f"Final stage must serve only static build output with nginx: {final[1:]!r}"]
    return []


def shell_commands(text: str) -> list[str]:
    result = []
    pending = ""
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if pending:
            line = pending + line
        if line.endswith("\\"):
            pending = line[:-1].rstrip() + " "
            continue
        pending = ""
        result.append(" ".join(line.split()))
    if pending:
        return []
    return result


def validate_npm_bootstrap(text: str) -> list[str]:
    commands = shell_commands(text)
    expected = [
        "set -eu",
        f"expected_integrity='{NPM_SRI}'",
        f"npm_config_engine_strict=true npm_config_registry=https://registry.npmjs.org npm pack npm@{NPM_VERSION} --pack-destination /tmp --json > /tmp/npm-{NPM_VERSION}.pack.json",
        f"actual_integrity=$(node -e \"process.stdout.write('sha512-' + require('node:crypto').createHash('sha512').update(require('node:fs').readFileSync('/tmp/npm-{NPM_VERSION}.tgz')).digest('base64'))\")",
        'if [ "$actual_integrity" != "$expected_integrity" ]; then',
        "printf '%s\\n' 'npm@11.10.0 tarball bytes do not match the official Registry SRI value' >&2",
        "exit 1",
        "fi",
        f"npm_config_engine_strict=true npm install --global --ignore-scripts /tmp/npm-{NPM_VERSION}.tgz",
        f'if [ "$(npm --version)" != "{NPM_VERSION}" ]; then',
        "printf '%s\\n' 'npm bootstrap did not activate version 11.10.0' >&2",
        "exit 1",
        "fi",
        f"rm -f /tmp/npm-{NPM_VERSION}.tgz /tmp/npm-{NPM_VERSION}.pack.json",
    ]
    if commands != expected:
        return [f"npm bootstrap command sequence mismatch: {commands!r}"]
    return []


def validate_repository(root: Path) -> list[str]:
    errors = []
    dockerfile = root / "Dockerfile"
    if not dockerfile.is_file():
        return ["Dockerfile is missing"]
    errors.extend(validate_dockerfile(dockerfile.read_text()))
    dockerignore = root / ".dockerignore"
    if not dockerignore.is_file():
        errors.append(".dockerignore is missing; verify COPY context inclusion policy")
    else:
        patterns = [
            line.strip()
            for line in dockerignore.read_text().splitlines()
            if line.strip() and not line.lstrip().startswith("#")
        ]
        if patterns != EXPECTED_DOCKERIGNORE:
            errors.append(
                "Docker build context exclusions need review; source .npmrc must remain included: "
                + repr(patterns)
            )
    npmrc = root / "src" / ".npmrc"
    if not npmrc.is_file():
        errors.append("src/.npmrc is missing")
    else:
        settings = {
            line.strip().lower()
            for line in npmrc.read_text().splitlines()
            if line.strip() and not line.lstrip().startswith("#")
        }
        if not {"engine-strict=true", "min-release-age=7"}.issubset(settings):
            errors.append("src/.npmrc must retain engine-strict=true and min-release-age=7")
    bootstrap = root / NPM_BOOTSTRAP
    if not bootstrap.is_file():
        errors.append("Pinned npm bootstrap script is missing")
    else:
        errors.extend(validate_npm_bootstrap(bootstrap.read_text()))
    compose_files = sorted(
        path.relative_to(root).as_posix()
        for path in root.rglob("*")
        if path.is_file()
        and path.name.lower() in COMPOSE_NAMES
        and not {".git", "node_modules", "dist", "build"}.intersection(path.parts)
    )
    if compose_files:
        errors.append(
            "Compose build overrides need explicit policy coverage: "
            + ", ".join(compose_files)
        )
    return errors


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    errors = validate_repository(root)
    if errors:
        for error in errors:
            print(f"FAIL: {error}", file=sys.stderr)
        return 1
    print("PASS: exact fixed Node index digest in the sole Node build stage")
    print("PASS: Docker build context includes .npmrc; one source copy precedes the SRI-checked npm bootstrap")
    print("PASS: final stage serves static build output with nginx")
    print("PASS: no Compose override path bypasses the reviewed Dockerfile")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
