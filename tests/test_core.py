import copy
import io
import json
import os
import subprocess
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch
from tracelens.analysis import analyze, satisfies, log_evidence, context_prompt
from tracelens.collector import capture, probe
from tracelens.cli import bundle
from tracelens.security import snapshot, redact, relative_path

ROOT = Path(__file__).resolve().parents[1]
DEMO = json.loads((ROOT / "examples/demo-input.json").read_text(encoding="utf-8"))


class Rules(unittest.TestCase):
    def test_demo_has_expected_evidence_and_not_a_root_cause_claim(self):
        report = analyze(DEMO["left"], DEMO["right"], DEMO["log"])
        self.assertEqual(report["summary"]["errors"], 4)
        self.assertEqual(report["summary"]["rulesTriggered"], 10)
        self.assertIn("not a proven root cause", report["scope"])
        self.assertTrue(
            next(f for f in report["findings"] if f["rule"] == "filesystem.case")["logEvidence"]
        )

    def test_identical_compatible_snapshots_are_clean(self):
        report = analyze(DEMO["left"], DEMO["left"])
        self.assertEqual(report["findings"], [])

    def test_case_insensitive_target_does_not_get_case_error(self):
        target = copy.deepcopy(DEMO["right"])
        target["platform"]["caseSensitive"] = False
        self.assertNotIn(
            "filesystem.case", [f["rule"] for f in analyze(DEMO["left"], target)["findings"]]
        )

    def test_unknown_case_sensitivity_is_not_assumed_from_os(self):
        target = copy.deepcopy(DEMO["right"])
        target["platform"]["caseSensitive"] = None
        self.assertNotIn(
            "filesystem.case", [f["rule"] for f in analyze(DEMO["left"], target)["findings"]]
        )

    def test_missing_tool_is_distinct_from_unprobed(self):
        target = copy.deepcopy(DEMO["right"])
        target["tools"]["git"] = {"status": "missing", "version": None}
        self.assertIn(
            "tool.missing.git", [f["rule"] for f in analyze(DEMO["left"], target)["findings"]]
        )
        target["tools"]["git"]["status"] = "unprobed"
        self.assertNotIn(
            "tool.missing.git", [f["rule"] for f in analyze(DEMO["left"], target)["findings"]]
        )

    def test_unknown_log_error_is_reported_without_inventing_cause(self):
        report = analyze(DEMO["left"], DEMO["left"], "ERROR quantum processor exploded")
        self.assertEqual(report["findings"], [])
        self.assertTrue(report["unknowns"])

    def test_declared_dependency_ranges_not_claimed_as_installed_versions(self):
        report = analyze(DEMO["left"], DEMO["right"])
        finding = next(f for f in report["findings"] if f["rule"] == "dependencies.declared")
        self.assertTrue(any("gerçek sürümü değildir" in step for step in finding["steps"]))

    def test_unsupported_version_constraint_is_unknown(self):
        target = copy.deepcopy(DEMO["left"])
        target["project"]["engines"]["node"] = "lts/*"
        report = analyze(DEMO["left"], target)
        self.assertTrue(report["unknowns"])
        self.assertNotIn("runtime.constraint.node", [f["rule"] for f in report["findings"]])

    def test_rule_identifiers_are_deterministic(self):
        self.assertEqual(
            [f["id"] for f in analyze(DEMO["left"], DEMO["right"])["findings"]],
            [f["id"] for f in analyze(DEMO["left"], DEMO["right"])["findings"]],
        )

    def test_log_lines_and_timestamps_are_real_positions(self):
        rows, _ = log_evidence("INFO start\n2026-11-10T09:14:03Z ERROR failed\n")
        self.assertEqual(rows[0]["line"], 2)
        self.assertEqual(rows[0]["time"], "2026-11-10T09:14:03Z")

    def test_archive_contains_only_allowlisted_entries_and_no_notes(self):
        report = analyze(
            DEMO["left"], DEMO["right"], "ERROR api_key=fixture_secret_837_do_not_export"
        )
        with zipfile.ZipFile(io.BytesIO(bundle(report))) as z:
            self.assertEqual(len(z.namelist()), 6)
            self.assertTrue(all("/" not in p for p in z.namelist()))
            self.assertNotIn("fixture_secret_837_do_not_export", z.read("report.json").decode())

    def test_handoff_is_bounded_and_contains_source_locations(self):
        prompt = context_prompt(analyze(DEMO["left"], DEMO["right"]))
        self.assertIn("web/main.ts", prompt)
        self.assertLessEqual(len(prompt), 8001)


class Constraints(unittest.TestCase):
    def test_supported_ranges(self):
        cases = [
            ("24.1.0", ">=22 <25", True),
            ("20.0.0", ">=22", False),
            ("20.7.0", "^20.0.0", True),
            ("21.0.0", "^20.0.0", False),
            ("0.2.9", "^0.2.3", True),
            ("0.3.0", "^0.2.3", False),
            ("20.9.1", "~20", True),
            ("21.0.0", "~20", False),
            ("20.1.4", "~20.1", True),
            ("20.2.0", "~20.1", False),
            ("3.12.9", "3.12", True),
            ("3.13.0", "3.12", False),
            ("20.4.0", "20.x", True),
            ("22.0.0", "20.x", False),
            ("24.1.0", "lts/*", None),
            ("20.0.0-rc.1", ">=20", None),
            ("24.1.0", "20 || 24", None),
        ]
        for version, constraint, expected in cases:
            with self.subTest(constraint=constraint, version=version):
                self.assertIs(satisfies(version, constraint), expected)


class Privacy(unittest.TestCase):
    def test_unknown_fields_and_environment_values_are_removed(self):
        source = copy.deepcopy(DEMO["left"])
        source["rawEnvironment"] = {"PASSWORD": "do-not-export"}
        source["project"]["env"][0]["value"] = "do-not-export"
        self.assertNotIn("do-not-export", json.dumps(snapshot(source)))

    def test_known_secrets_and_url_passwords_are_masked(self):
        for text, secret in [
            ("API_KEY=" + "sk-" + "a" * 25, "sk-" + "a" * 25),
            ("password=abcdefgh", "abcdefgh"),
            ("https://u:passphrase@example.com", "passphrase"),
            ("Bearer " + "z" * 25, "z" * 25),
        ]:
            self.assertNotIn(secret, redact(text))

    def test_private_key_redaction_preserves_line_numbers(self):
        value = "-----BEGIN PRIVATE KEY-----\nsecretkey\n-----END PRIVATE KEY-----\nERROR failed"
        cleaned = redact(value)
        self.assertNotIn("secretkey", cleaned)
        self.assertEqual(cleaned.splitlines().index("ERROR failed"), 3)

    def test_home_paths_are_generalized(self):
        self.assertNotIn("Alice", redact("C:\\Users\\Alice\\project /home/Alice/project"))

    def test_traversal_and_absolute_paths_are_rejected(self):
        for path in ("../outside", "C:/Users/name", "/etc/passwd", "a/../../b", "bad\nname"):
            with self.assertRaises(ValueError):
                relative_path(path)

    def test_snapshot_version_and_tool_versions_are_validated(self):
        with self.assertRaises(ValueError):
            snapshot({"schemaVersion": 99})
        source = copy.deepcopy(DEMO["left"])
        source["tools"]["node"]["version"] = "$(execute)"
        with self.assertRaises(ValueError):
            snapshot(source)


class Capture(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.ceiling = os.environ.get("GIT_CEILING_DIRECTORIES")
        os.environ["GIT_CEILING_DIRECTORIES"] = str(self.root.parent)

    def tearDown(self):
        self.tmp.cleanup()
        if self.ceiling is None:
            os.environ.pop("GIT_CEILING_DIRECTORIES", None)
        else:
            os.environ["GIT_CEILING_DIRECTORIES"] = self.ceiling

    def put(self, path, text):
        p = self.root / path
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text, encoding="utf-8")
        return p

    def test_capture_no_probe_never_runs_runtime_commands(self):
        self.put(
            "package.json",
            json.dumps(
                {
                    "name": "fixture",
                    "engines": {"node": ">=22"},
                    "scripts": {"postinstall": "dangerous-command"},
                }
            ),
        )
        with patch("tracelens.collector.probe", side_effect=AssertionError("probe forbidden")):
            report = capture(self.root, probes=False)
        self.assertTrue(all(t["status"] == "unprobed" for t in report["tools"].values()))
        self.assertNotIn("dangerous-command", json.dumps(report))

    def test_only_env_key_presence_is_captured(self):
        self.put(".env.example", "PAYMENT_TOKEN=example\nDATABASE_URL=example")
        self.put(".env", "DATABASE_URL=never-export-this")
        with patch.dict(os.environ, {"PAYMENT_TOKEN": "private-value"}):
            result = capture(self.root, probes=False)
        self.assertNotIn("private-value", json.dumps(result))
        self.assertNotIn("never-export-this", json.dumps(result))
        self.assertTrue(
            next(x for x in result["project"]["env"] if x["name"] == "PAYMENT_TOKEN")["defined"]
        )

    def test_typescript_case_mismatch_is_measured_from_paths(self):
        self.put("web/main.ts", 'import {user} from "./UserService";')
        self.put("web/userService.ts", "export const user=1")
        report = capture(self.root, probes=False)
        self.assertTrue(report["imports"][0]["caseMismatch"])
        self.assertEqual(report["imports"][0]["target"], "web/userService.ts")

    def test_probe_parses_node_v_prefix_correctly(self):
        with (
            patch("tracelens.collector.shutil.which", return_value=sys.executable),
            patch(
                "tracelens.collector.subprocess.run",
                return_value=subprocess.CompletedProcess([], 0, b"v24.1.0\n"),
            ),
        ):
            self.assertEqual(probe("node", self.root)["version"], "24.1.0")

    def test_probe_rejects_executable_inside_project(self):
        binary = self.put("node.exe", "not executable")
        with (
            patch("tracelens.collector.shutil.which", return_value=str(binary)),
            patch("tracelens.collector.subprocess.run", side_effect=AssertionError("must not run")),
        ):
            self.assertEqual(probe("node", self.root)["status"], "unprobed")

    def test_dotnet_target_framework_is_read_without_building(self):
        self.put(
            "api/App.csproj",
            "<Project><PropertyGroup><TargetFramework>net10.0</TargetFramework></PropertyGroup></Project>",
        )
        self.assertEqual(capture(self.root, probes=False)["project"]["frameworks"], ["net10.0"])

    def test_cli_capture_compare_and_bundle(self):
        self.put("app.py", 'print("metadata only")')
        env = dict(os.environ, PYTHONPATH=str(ROOT / "src"))
        target = self.root / "snapshot.json"
        command = [
            sys.executable,
            "-m",
            "tracelens",
            "capture",
            "--root",
            str(self.root),
            "--no-probe",
            "--out",
            str(target),
        ]
        r = subprocess.run(command, capture_output=True, env=env)
        self.assertEqual(r.returncode, 0, r.stderr)
        r = subprocess.run(command, capture_output=True, env=env)
        self.assertEqual(r.returncode, 2)
        archive = self.root / "bundle.zip"
        r = subprocess.run(
            [
                sys.executable,
                "-m",
                "tracelens",
                "bundle",
                str(target),
                str(target),
                "--out",
                str(archive),
            ],
            capture_output=True,
            env=env,
        )
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertTrue(zipfile.is_zipfile(archive))

    def test_source_symlink_is_not_followed(self):
        p = self.put("original.py", "source=1")
        try:
            (self.root / "linked.py").symlink_to(p)
        except OSError:
            self.skipTest("Account lacks symlink permission")
        self.assertNotIn("linked.py", capture(self.root, probes=False)["files"])


if __name__ == "__main__":
    unittest.main()
