import json
import re
from pathlib import PurePosixPath

PATTERNS = [
    (
        re.compile(
            r"\b(?:sk-[\w-]{16,}|gh[pousr]_[\w]{20,}|github_pat_[\w]{20,}|AKIA[A-Z0-9]{16})\b"
        ),
        "[REDACTED]",
    ),
    (
        re.compile(
            r'(?i)((?:api[_-]?key|access[_-]?token|client[_-]?secret|password|pwd|authorization)\s*[:=]\s*["\x27]?)[^\s"\x27,;]{4,}'
        ),
        r"\1[REDACTED]",
    ),
    (re.compile(r"(?i)(Bearer\s+)[A-Za-z0-9._~+/=-]{8,}"), r"\1[REDACTED]"),
    (re.compile(r"(?i)(https?://)[^\s/@:]+:[^\s/@]+@"), r"\1[REDACTED]@"),
    (re.compile(r"(?i)[A-Z]:[\\/]Users[\\/][^\\/\s]+"), "<HOME>"),
    (re.compile(r"/(?:home|Users)/[^/\s]+"), "<HOME>"),
    (re.compile(r"\x1b\[[0-?]*[ -/]*[@-~]"), ""),
]


def redact(text):
    text = re.sub(
        r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?(?:-----END [^-]+-----|$)",
        lambda m: "[REDACTED PRIVATE KEY]" + "\n" * m.group(0).count("\n"),
        text,
    )
    for pattern, replacement in PATTERNS:
        text = pattern.sub(replacement, text)
    return text


def clean(value):
    if isinstance(value, str):
        return redact(value)
    if isinstance(value, list):
        return [clean(x) for x in value]
    if isinstance(value, dict):
        return {redact(str(k)): clean(v) for k, v in value.items()}
    return value


def relative_path(value):
    if not isinstance(value, str) or not 1 <= len(value) <= 300:
        raise ValueError("Invalid relative file path.")
    p = PurePosixPath(value.replace("\\", "/"))
    if p.is_absolute() or ".." in p.parts or ":" in value or any(ord(c) < 32 for c in value):
        raise ValueError("Absolute or escaping file paths are not accepted.")
    return p.as_posix()


def string(value, limit=100):
    if not isinstance(value, str) or len(value) > limit:
        raise ValueError("Invalid text field.")
    return redact(value)


def snapshot(value):
    """Rebuild an allowlisted schema instead of retaining unknown imported fields."""
    if not isinstance(value, dict) or value.get("schemaVersion") != 1:
        raise ValueError("Snapshot schemaVersion must be 1.")
    label = string(value.get("label", "Unnamed environment"), 80)
    platform = value.get("platform", {})
    if not isinstance(platform, dict):
        raise ValueError("Invalid platform.")
    system = platform.get("system", "unknown")
    if system not in ("Windows", "Linux", "Darwin", "unknown"):
        raise ValueError("Unsupported platform name.")
    sensitive = platform.get("caseSensitive")
    if sensitive is not None and not isinstance(sensitive, bool):
        raise ValueError("caseSensitive must be a boolean or null.")
    tools = {}
    for name, entry in value.get("tools", {}).items():
        if name not in ("node", "python", "dotnet", "git"):
            continue
        if not isinstance(entry, dict):
            raise ValueError("Invalid tool entry.")
        status = entry.get("status", "unknown")
        if status not in ("available", "missing", "error", "unprobed", "unknown"):
            raise ValueError("Invalid tool status.")
        version = entry.get("version")
        if version is not None and (
            not isinstance(version, str)
            or not re.fullmatch(r"\d+(?:\.\d+){0,3}(?:[-+][\w.-]+)?", version)
        ):
            raise ValueError("Invalid tool version.")
        tools[name] = {"status": status, "version": version}
    project = value.get("project", {})
    if not isinstance(project, dict):
        raise ValueError("Invalid project.")
    env = []
    for entry in project.get("env", [])[:100]:
        name = entry.get("name", "")
        if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]{0,79}", name) or not isinstance(
            entry.get("defined"), bool
        ):
            raise ValueError("Invalid environment key metadata.")
        env.append({"name": name, "defined": entry["defined"]})
    deps = []
    for entry in project.get("dependencies", [])[:400]:
        name = string(entry.get("name"), 120)
        version = string(entry.get("version"), 120)
        if not re.fullmatch(r"[@A-Za-z0-9_./-]+", name):
            raise ValueError("Invalid dependency name.")
        deps.append(
            {"name": name, "version": version, "kind": string(entry.get("kind", "declared"), 20)}
        )
    locks = []
    for entry in project.get("locks", [])[:12]:
        sha = entry.get("sha256", "")
        if not re.fullmatch(r"[0-9a-f]{64}", sha):
            raise ValueError("Invalid lockfile fingerprint.")
        locks.append({"file": relative_path(entry["file"]), "sha256": sha})
    files = []
    if len(value.get("files", [])) > 5000:
        raise ValueError("Snapshot file limit is 5000.")
    for path in value.get("files", []):
        files.append(relative_path(path))
    imports = []
    for entry in value.get("imports", [])[:2000]:
        line = entry.get("line", 0)
        if not isinstance(line, int) or not 1 <= line <= 1000000:
            raise ValueError("Invalid import line.")
        target = entry.get("target")
        imports.append(
            {
                "file": relative_path(entry["file"]),
                "line": line,
                "spec": string(entry.get("spec", ""), 250),
                "target": relative_path(target) if target else None,
                "caseMismatch": bool(entry.get("caseMismatch", False)),
            }
        )
    scripts = [
        {"file": relative_path(s["file"]), "crlf": bool(s.get("crlf"))}
        for s in value.get("scripts", [])[:100]
    ]
    return {
        "schemaVersion": 1,
        "label": label,
        "platform": {
            "system": system,
            "arch": string(platform.get("arch", "unknown"), 30),
            "caseSensitive": sensitive,
        },
        "tools": tools,
        "project": {
            "name": string(project.get("name", "Unnamed project"), 120),
            "engines": {
                k: string(v, 80)
                for k, v in project.get("engines", {}).items()
                if k in ("node", "python", "dotnet")
            },
            "frameworks": [string(x, 40) for x in project.get("frameworks", [])[:30]],
            "packageManager": string(project.get("packageManager", "unknown"), 80),
            "env": env,
            "dependencies": deps,
            "locks": locks,
        },
        "files": sorted(set(files)),
        "imports": imports,
        "scripts": scripts,
        "capture": {
            "limited": bool(value.get("capture", {}).get("limited", False)),
            "probeEnabled": bool(value.get("capture", {}).get("probeEnabled", False)),
        },
    }
