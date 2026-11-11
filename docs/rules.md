# Rule coverage and limits

Rules compare the right/target snapshot with the left/source snapshot and requirements declared by the project. Severity is review priority. Confidence expresses evidence strength, not a calibrated probability.

| Signal | What is established | What is not established |
| --- | --- | --- |
| Runtime missing | Target probe reports a missing executable that exists on the source | An unprobed runtime is not treated as missing |
| Runtime major drift | Available runtime major versions differ | Different majors may both be compatible |
| Node/Python constraint | Supported declared version expression rejects the observed target version | Full npm/PEP 440 resolution is not implemented |
| .NET target | Observed SDK major is below a `netN.0` target | `global.json` rollForward/allowPrerelease behavior is not modeled |
| Environment key absent | Template lists a key; target process has no non-empty value | `.env` loading, remote secrets and app defaults are not evaluated |
| Declared dependency drift | Manifest declarations differ | Installed/resolved package versions are not measured |
| Lockfile hash drift | Same-path lockfile hashes differ | Hash drift alone is not a broken install |
| Package manager drift | Declared package manager strings differ | Installed manager capability is not probed |
| Import case mismatch | Relative JS/TS import casing differs from a discovered file and target FS is measured case-sensitive | Aliases, bundler plugins and every extension-resolution rule are not modeled |
| Shell CRLF | A discovered `.sh` contains CRLF and target is Linux | Invocation mode and interpreter policy still matter |
| Architecture drift | Platform architecture labels differ | Native package compatibility requires further inspection |

Supported version syntax includes common numeric comparisons, caret, tilde, numeric prefixes and `x` wildcards. Complex alternatives (`||`), symbolic channels and prerelease edge cases return unknown rather than a compatibility assertion. A missing or truncated inventory cannot prove there are no other problems.

Collection bounds include 5,000 files, 512 KB per selected text file, a 16 MB total content-read budget, 2,000 imports and bounded metadata lists. Large lockfiles beyond the per-file limit are omitted. Symlinks/reparse points and common generated/secret directories are excluded. The collector does not read arbitrary `.env` values.

Log matching selects likely error lines (up to 100) from at most one million characters, preserving their original line numbers. A matching message supports a finding; it does not demonstrate causality. Unmatched failures remain unknown. No fix commands are automatically run.

The synthetic example intentionally triggers ten findings. It is an integration fixture, not an accuracy benchmark on real-world repositories.
