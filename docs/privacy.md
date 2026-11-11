# Privacy and local threat model

## Intended use

A single developer runs TraceLens on their own computer and reviews project metadata before sending it anywhere. The workbench is not an authenticated team service. Do not expose ports 9280/9281 on a public interface or put the API behind an internet-facing proxy without designing authentication, authorization and network protections.

## Collected intentionally

Runtime versions/status, operating system and architecture, relative project paths, manifest dependency declarations, lockfile SHA-256 hashes, target frameworks, environment **key names and non-empty presence booleans**, selected import metadata and shell line endings. Source bodies are read locally only for selected analysis and are not retained in snapshots.

`.env` files are not used to collect values. Template key names are checked against the running process environment. No host environment dump, shell history, browser history or credential-store access occurs.

## Imported and pasted content

Snapshot objects are rebuilt using an allowlist. Unknown properties, including injected environment `value` fields, are dropped. Paths reject absolute locations, traversal and control characters. Known token patterns, Bearer headers, assignment-style credentials, URL passwords, home paths and private-key blocks are masked. This cannot recognize every secret format or every personal detail. Do not paste data you are not permitted to process.

The report and handoff treat evidence as project data, not executable instructions. A downstream coding agent still needs its own prompt-injection and tool-authorization protections.

## Local storage and sharing

SQLite stores sanitized reports and local notes under the configured `DataPath`. Notes and titles are user-written local content; notes are not automatically redacted and should not contain secrets. ZIP exports exclude notes and review state. They contain the report, two sanitized snapshots, redacted log, source-free handoff and sharing notice. Paths and package names can still be confidential.

The UI preview exposes the same report metadata used for export. Downloading does not upload anything or create a public link. The user decides where to send the file.

The optional CLI ContextPilot integration is different: it explicitly runs a trusted helper and can append local source excerpts. Review that separate output independently. The web API cannot invoke an arbitrary helper supplied by a request.

## Execution boundaries

Capture uses fixed runtime-version commands and read-only Git discovery, with no shell and no project hooks. Runtime tools may initialize their own user caches. `--no-probe` skips runtime commands, but Git discovery can still run. Do not treat source inspection as a hardened sandbox for deliberately hostile repositories or malicious runtime installations.

The API enforces bounded request bodies, host restrictions and same-origin checks on browser writes. A separate malicious local process can still call a loopback service; operating-system isolation and trusted local users remain assumptions.
