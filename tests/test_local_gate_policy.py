"""Execute the owning hook in a disposable root with observed tool boundaries."""
from pathlib import Path
import os
import shutil
import subprocess
import tempfile
import unittest

SOURCE = Path(__file__).resolve().parents[1]
PREFIX = "VISUALSUBNETCALC"

class LocalGatePolicy(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        hooks = self.root / 'scripts/hooks'
        hooks.mkdir(parents=True)
        for name in ('lib.sh', 'run-local-ci.sh'):
            shutil.copy2(SOURCE / 'scripts/hooks' / name, hooks / name)
        self.hook = hooks / 'run-local-ci.sh'
        self.tools = self.root / 'tools'
        self.tools.mkdir()
        self.marker = self.root / 'called'
        self.environment = {**os.environ, 'PATH': str(self.tools)+':/usr/bin:/bin', 'MARKER': str(self.marker)}
        for key in (PREFIX+'_SKIP_HOOKS', PREFIX+'_LOCAL_CI_IN_PROGRESS'):
            self.environment.pop(key, None)
        self.environment['NO_SERVER'] = '1'
        (self.root/'config').mkdir()
        (self.root/'config/input.yml').write_text('value: fixture\n')
        self.tool('npm', 'printf "%s|%s|%s\n" "$*" "${CI:-}" "${NO_SERVER:-}" >> "$MARKER"\nexit 0')
        self.tool('uv', 'case "$*" in *test_local_gate_policy.py*|*test_browser_ci_guards.py*) exit 0;; esac\nprintf "%s\n" "$*" >> "$MARKER"\nexit 0')
        self.tool('yamllint', 'printf "yaml\n" >> "$MARKER"\nexit 0')

    def tool(self, name, body):
        path = self.tools/name
        path.write_text('#!/bin/sh\n'+body+'\n')
        path.chmod(0o755)

    def run_hook(self, **extra):
        return subprocess.run(['/bin/bash', str(self.hook), '--execute'], cwd=self.root,
                              env={**self.environment, **extra}, capture_output=True, text=True)

    def test_skip_and_recursion_refuse_before_tools(self):
        for key in (PREFIX+'_SKIP_HOOKS', PREFIX+'_LOCAL_CI_IN_PROGRESS'):
            result = self.run_hook(**{key:'1'})
            self.assertNotEqual(result.returncode, 0)
            self.assertFalse(self.marker.exists())

    def test_ci_guards_are_set_for_actual_build_and_test_and_server_is_required(self):
        result = self.run_hook()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.marker.read_text().splitlines(), ['run build|true|', 'test|true|'])

    def test_failed_browser_check_propagates(self):
        self.tool('npm', 'case "$*" in test) exit 25;; esac\nexit 0')
        result = self.run_hook()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('npm test', result.stderr)


if __name__ == '__main__':
    unittest.main()
