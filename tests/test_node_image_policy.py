"""Regression fixtures for the reviewed Node and npm build-toolchain policy."""

from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from check_node_image_policy import (  # noqa: E402
    FINAL_FROM,
    NODE_FROM,
    NPM_BOOTSTRAP,
    NPM_SRI,
    NPM_VERSION,
    validate_dockerfile,
    validate_npm_bootstrap,
    validate_repository,
)

STATIC_COPY = "COPY --from=build /app/dist /usr/share/nginx/html"
BOOTSTRAP = "scripts/install-pinned-npm.sh"
BOOTSTRAP_RUN = "RUN sh /app/scripts/install-pinned-npm.sh"
SOURCE_COPY = "COPY . /app"
DOCKERIGNORE = ".gitignore\nLICENSE\nREADME.md\n"


def dockerfile(node_from: str = f"FROM {NODE_FROM}", final_from: str = f"FROM {FINAL_FROM}") -> str:
    return (
        f"{node_from}\nARG REACT_APP_SERVICES_HOST=/services/m\nWORKDIR /app/src\n"
        f"{SOURCE_COPY}\n{BOOTSTRAP_RUN}\nRUN npm install\n"
        f"RUN npm run build\n{final_from}\n{STATIC_COPY}\nUSER nginx\n"
    )


def valid_bootstrap() -> str:
    return (ROOT / BOOTSTRAP).read_text()


class NodeImagePolicy(unittest.TestCase):
    def test_accepts_reviewed_digest_install_order_and_static_serving_scope(self):
        self.assertEqual(validate_dockerfile(dockerfile()), [])

    def test_rejects_node_20_floating_tag_and_tag_without_digest(self):
        self.assertTrue(validate_dockerfile(dockerfile("FROM node:20-alpine AS build")))
        self.assertTrue(validate_dockerfile(dockerfile("FROM node:22-alpine AS build")))
        self.assertTrue(validate_dockerfile(dockerfile("FROM node:22.23.4-alpine3.24 AS build")))

    def test_rejects_arg_selected_or_extra_node_stages(self):
        self.assertTrue(validate_dockerfile(dockerfile("FROM $NODE_IMAGE AS build")))
        extra = dockerfile().replace(
            f"FROM {FINAL_FROM}", f"FROM node:22.23.4-alpine3.24 AS extra\nFROM {FINAL_FROM}"
        )
        self.assertTrue(validate_dockerfile(extra))

    def test_rejects_node_serving_stage(self):
        self.assertTrue(validate_dockerfile(dockerfile(final_from="FROM node:22.23.4-alpine3.24")))

    def test_comments_do_not_satisfy_copy_or_install_instructions(self):
        no_source_copy = dockerfile().replace(SOURCE_COPY, f"# {SOURCE_COPY}")
        self.assertTrue(validate_dockerfile(no_source_copy))
        no_static_copy = dockerfile().replace(STATIC_COPY, f"# {STATIC_COPY}")
        self.assertTrue(validate_dockerfile(no_static_copy))
        no_bootstrap = dockerfile().replace(BOOTSTRAP_RUN, f"# {BOOTSTRAP_RUN}")
        self.assertTrue(validate_dockerfile(no_bootstrap))

    def test_bootstrap_in_irrelevant_stage_does_not_satisfy_build_stage(self):
        misplaced = dockerfile().replace(BOOTSTRAP_RUN + "\n", "")
        misplaced = misplaced.replace("FROM nginxinc", BOOTSTRAP_RUN + "\nFROM nginxinc")
        self.assertTrue(validate_dockerfile(misplaced))

    def test_npmrc_and_bootstrap_must_precede_install(self):
        late = dockerfile().replace(
            f"{BOOTSTRAP_RUN}\nRUN npm install",
            f"RUN npm install\n{BOOTSTRAP_RUN}",
        )
        self.assertTrue(validate_dockerfile(late))

    def test_extra_npm_run_or_duplicate_source_copy_is_rejected(self):
        extra_npm = dockerfile().replace(
            f"{SOURCE_COPY}\n{BOOTSTRAP_RUN}",
            f"{SOURCE_COPY}\nRUN npm install --global npm@latest\n{BOOTSTRAP_RUN}",
        )
        self.assertTrue(validate_dockerfile(extra_npm))
        extra_copy = dockerfile().replace(
            f"{SOURCE_COPY}\n{BOOTSTRAP_RUN}",
            f"{SOURCE_COPY}\nCOPY src/.npmrc /app/src/.npmrc\n{BOOTSTRAP_RUN}",
        )
        self.assertTrue(validate_dockerfile(extra_copy))

    def test_bootstrap_requires_pinned_sri_age_engine_and_exact_package(self):
        self.assertEqual(validate_npm_bootstrap(valid_bootstrap()), [])
        self.assertTrue(validate_npm_bootstrap(valid_bootstrap().replace(NPM_SRI, "sha512-wrong")))
        self.assertTrue(validate_npm_bootstrap(valid_bootstrap().replace(f"npm@{NPM_VERSION}", "npm@latest")))
        self.assertTrue(validate_npm_bootstrap(valid_bootstrap().replace(f"npm@{NPM_VERSION}", "npm@11.10.1")))

    def test_comment_cannot_spoof_bootstrap_integrity(self):
        text = valid_bootstrap().replace(f"expected_integrity='{NPM_SRI}'", "# expected_integrity='fake'\nexpected_integrity='wrong'")
        self.assertTrue(validate_npm_bootstrap(text))
        no_runtime_version = valid_bootstrap().replace(
            'if [ "$(npm --version)" != "11.10.0" ]; then\n'
            "  printf '%s\\n' 'npm bootstrap did not activate version 11.10.0' >&2\n"
            "  exit 1\nfi\n",
            "",
        )
        self.assertTrue(validate_npm_bootstrap(no_runtime_version))

    def test_actual_repository_has_no_compose_override_route(self):
        self.assertEqual(validate_repository(ROOT), [])

    def test_repository_npmrc_keeps_engine_and_release_age_policy(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "Dockerfile").write_text(dockerfile())
            (root / ".dockerignore").write_text(DOCKERIGNORE)
            (root / "src").mkdir()
            (root / "src" / ".npmrc").write_text("engine-strict=true\n")
            (root / BOOTSTRAP).parent.mkdir(parents=True)
            (root / BOOTSTRAP).write_text(valid_bootstrap())
            self.assertTrue(validate_repository(root))

    def test_dockerignore_cannot_exclude_npmrc_or_change_context_unreviewed(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "Dockerfile").write_text(dockerfile())
            (root / ".dockerignore").write_text(DOCKERIGNORE + "src/.npmrc\n")
            (root / "src").mkdir()
            (root / "src" / ".npmrc").write_text(
                "engine-strict=true\nmin-release-age=7\n"
            )
            (root / BOOTSTRAP).parent.mkdir(parents=True)
            (root / BOOTSTRAP).write_text(valid_bootstrap())
            self.assertTrue(validate_repository(root))

    def test_nested_compose_file_blocks_until_covered_by_policy(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "Dockerfile").write_text(dockerfile())
            (root / ".dockerignore").write_text(DOCKERIGNORE)
            (root / "src").mkdir()
            (root / "src" / ".npmrc").write_text("engine-strict=true\nmin-release-age=7\n")
            (root / BOOTSTRAP).parent.mkdir(parents=True)
            (root / BOOTSTRAP).write_text(valid_bootstrap())
            nested = root / "examples" / "demo"
            nested.mkdir(parents=True)
            (nested / "docker-compose.yaml").write_text(
                "services:\n  app:\n    build:\n      dockerfile: Dockerfile\n"
            )
            self.assertTrue(validate_repository(root))


if __name__ == "__main__":
    unittest.main()
