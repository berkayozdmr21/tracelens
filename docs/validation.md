# Validation protocol

Tests check observable behavior and boundary conditions. They do not claim universal diagnosis accuracy or quantified token savings.

## Engine: unittest

27 test methods cover deterministic fixture counts, clean comparisons, missing versus unprobed runtimes, unsupported constraints, filesystem case-sensitivity evidence, dependency wording, stable IDs, original log lines, redaction, imported-field dropping, traversal rejection, safe bundles, source-free handoffs, capture without project hooks, runtime-version parsing, local-executable rejection, .NET metadata, CLI round trips and symlink handling. The Windows symlink case skips where link creation is unavailable.

The CI matrix runs Windows/Linux with Python 3.9 and 3.12. This checks cross-platform capture behavior; the synthetic Windows/Linux fixture is clearly distinguished from the actual runner environment.

## HTTP integration: Node test runner

Two scenarios exercise a real running API and SQLite database:

1. Create, resolve, reject a stale revision, persist notes, reload, download, archive and restore.
2. Reject invalid schemas/traversal, mask a known token, reject a hostile browser origin and return 404 for an unknown case.

The database is isolated in `.runtime/ci` on the ephemeral CI runner. Local reruns add test cases; the 100-case limit still applies.

## Browser: Playwright in CI

Two Chromium scenarios exercise desktop investigation and narrow-screen JSON validation/import. The desktop flow follows case creation through evidence, notes/reload, resolved state, environment comparison, log timeline, ZIP download, archive and restore. The mobile flow checks malformed JSON feedback and horizontal overflow at 390 pixels. Screenshots and failure traces are uploaded as `browser-evidence` artifacts.

Local interactive QA uses the actual workbench: example input, evidence expansion, note persistence after reload, resolution, environment/log/share tabs and responsive layouts. Automated browser execution runs in GitHub CI.

## Manual reproduction

Run the commands in the root README. To inspect a deterministic example without starting the API:

```sh
tracelens compare examples/left.snapshot.json examples/right.snapshot.json --log examples/ci.redacted.log --out checked-report.json
tracelens bundle examples/left.snapshot.json examples/right.snapshot.json --log examples/ci.redacted.log --out checked-evidence.zip
```

Expected fixture: 4 errors, 5 warnings, 1 information finding, 6 timeline entries. Check that no environment values or source bodies are present and that the ZIP contains exactly the documented six files. Test assertions use fake credential strings; no real key is required.
