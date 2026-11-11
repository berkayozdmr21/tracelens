"""Metadata-only capture; fixed executable probes, never project install/build hooks."""

import hashlib
import json
import os
import platform
import posixpath
import re
import shutil
import stat
import subprocess
import sys
import xml.etree.ElementTree as ET
from pathlib import Path, PurePosixPath
from .security import snapshot

SKIP = {
    ".git",
    ".tools",
    ".runtime",
    ".contextpilot",
    ".venv",
    "venv",
    "node_modules",
    "bin",
    "obj",
    "dist",
    "build",
    "__pycache__",
}
EXT = {
    ".py",
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".cs",
    ".csproj",
    ".json",
    ".yaml",
    ".yml",
    ".toml",
    ".dart",
    ".sh",
    ".md",
    ".props",
    ".targets",
}


def safe(root, relative):
    p = root / relative
    if any(part in SKIP for part in Path(relative).parts):
        return None
    for current in [
        root,
        *[root / Path(*Path(relative).parts[: i + 1]) for i in range(len(Path(relative).parts))],
    ]:
        if current.is_symlink() or (
            current.exists()
            and getattr(current.lstat(), "st_file_attributes", 0)
            & getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 1024)
        ):
            return None
    try:
        p.resolve().relative_to(root)
    except ValueError:
        return None
    return p if p.is_file() and p.stat().st_size <= 512000 else None


def read(root, name):
    p = safe(root, name)
    return p.read_text(encoding="utf-8-sig", errors="replace") if p else None


def probe(name, root):
    executable = sys.executable if name == "python" else shutil.which(name)
    if not executable:
        return {"status": "missing", "version": None}
    resolved = Path(executable).resolve()
    try:
        resolved.relative_to(root)
        return {"status": "unprobed", "version": None}
    except ValueError:
        pass
    try:
        r = subprocess.run(
            [str(resolved), "--version"],
            cwd=str(Path(sys.executable).parent),
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            timeout=8,
            env={
                **os.environ,
                "DOTNET_SKIP_FIRST_TIME_EXPERIENCE": "1",
                "DOTNET_CLI_TELEMETRY_OPTOUT": "1",
            },
        )
        match = re.search(
            r"(?<![A-Za-z0-9])v?(\d+(?:\.\d+){1,3}(?:[-+][\w.-]+)?)",
            r.stdout.decode("utf-8", errors="replace")[:2000],
        )
        return {
            "status": "available" if r.returncode == 0 and match else "error",
            "version": match.group(1) if match else None,
        }
    except (OSError, subprocess.TimeoutExpired):
        return {"status": "error", "version": None}


def paths(root):
    try:
        r = subprocess.run(
            [
                "git",
                "-C",
                str(root),
                "ls-files",
                "-z",
                "--cached",
                "--others",
                "--exclude-standard",
            ],
            capture_output=True,
            timeout=15,
        )
        if r.returncode:
            raise OSError()
        names = sorted(set(r.stdout.decode("utf-8").split("\0")) - {""})
    except (OSError, UnicodeError, subprocess.TimeoutExpired):
        names = []
        for directory, dirs, files in os.walk(root, followlinks=False):
            dirs[:] = sorted(
                d for d in dirs if d not in SKIP and not (Path(directory) / d).is_symlink()
            )
            for name in files:
                names.append((Path(directory) / name).relative_to(root).as_posix())
                if len(names) > 20000:
                    raise ValueError("Directory too large; choose a narrower project root.")
    eligible = []
    for name in names:
        p = PurePosixPath(name)
        if (
            p.suffix.lower() in EXT
            and not p.name.startswith(".env")
            and not re.search(r"(?i)(secret|credential|private[._-]?key)", p.name)
            and safe(root, name)
        ):
            eligible.append(name)
    return eligible[:5000], len(eligible) > 5000


def capture(root, label="Local environment", probes=True):
    root = Path(root).resolve()
    if not root.is_dir():
        raise ValueError("Project root must be a directory.")
    names, limited = paths(root)
    project = {
        "name": root.name,
        "engines": {},
        "packageManager": "unknown",
        "frameworks": [],
        "dependencies": [],
        "env": [],
        "locks": [],
    }
    package = read(root, "package.json")
    if package:
        data = json.loads(package)
        project["name"] = str(data.get("name", root.name))
        project["engines"] = {k: str(v) for k, v in data.get("engines", {}).items() if k == "node"}
        project["packageManager"] = str(
            data.get("packageManager", "npm" if read(root, "package-lock.json") else "unknown")
        )
        for section in ("dependencies", "devDependencies"):
            for name, version in data.get(section, {}).items():
                project["dependencies"].append(
                    {"name": name, "version": str(version), "kind": section}
                )
    for name, tool in (
        (".nvmrc", "node"),
        (".node-version", "node"),
        (".python-version", "python"),
    ):
        text = read(root, name)
        if text and len(text.strip()) <= 40:
            project["engines"][tool] = text.strip().lstrip("v")
    global_json = read(root, "global.json")
    if global_json:
        version = json.loads(global_json).get("sdk", {}).get("version")
        if version:
            project["engines"]["dotnet"] = str(version)
    for name in ("package-lock.json", "pnpm-lock.yaml", "yarn.lock", "poetry.lock", "pubspec.lock"):
        p = safe(root, name)
        if p:
            project["locks"].append(
                {"file": name, "sha256": hashlib.sha256(p.read_bytes()).hexdigest()}
            )
    for example in (".env.example", ".env.template"):
        text = read(root, example)
        if text:
            for key in re.findall(r"(?m)^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=", text):
                if key not in {x["name"] for x in project["env"]}:
                    project["env"].append({"name": key, "defined": bool(os.environ.get(key))})
    imports = []
    scripts = []
    case_sensitive = None
    total = 0
    lookup = {p.casefold(): p for p in names}
    for name in names:
        p = safe(root, name)
        if not p:
            continue
        total += p.stat().st_size
        if total > 16_000_000:
            limited = True
            break
        text = read(root, name) or ""
        if case_sensitive is None and p.name.swapcase() != p.name:
            variant = p.with_name(p.name.swapcase())
            try:
                case_sensitive = not variant.exists() or not os.path.samefile(p, variant)
            except OSError:
                pass
        if name.endswith((".csproj", ".props")):
            try:
                xml = ET.fromstring(text)
                for e in xml.iter():
                    if e.tag.split("}")[-1] in ("TargetFramework", "TargetFrameworks") and e.text:
                        project["frameworks"] += e.text.strip().split(";")
            except ET.ParseError:
                pass
        if name.endswith(".sh"):
            scripts.append(
                {"file": name, "crlf": "\r\n" in p.read_bytes().decode("utf-8", errors="replace")}
            )
        if not name.endswith((".js", ".jsx", ".ts", ".tsx", ".dart")):
            continue
        pattern = r"""(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)['"](\.[^'"\n]+)['"]"""
        for match in list(re.finditer(pattern, text))[:80]:
            spec = match.group(1)
            base = posixpath.normpath(posixpath.join(str(PurePosixPath(name).parent), spec))
            if base.startswith("../"):
                continue
            candidates = [base] + [
                base + s for s in (".ts", ".tsx", ".js", ".jsx", ".dart", "/index.ts", "/index.js")
            ]
            actual = next((c for c in candidates if c in names), None)
            mismatch = False
            if not actual:
                actual = next(
                    (lookup[c.casefold()] for c in candidates if c.casefold() in lookup), None
                )
                mismatch = bool(actual)
            imports.append(
                {
                    "file": name,
                    "line": text[: match.start()].count("\n") + 1,
                    "spec": spec,
                    "target": actual,
                    "caseMismatch": mismatch,
                }
            )
    return snapshot(
        {
            "schemaVersion": 1,
            "label": label,
            "platform": {
                "system": (
                    platform.system()
                    if platform.system() in ("Windows", "Linux", "Darwin")
                    else "unknown"
                ),
                "arch": platform.machine(),
                "caseSensitive": case_sensitive,
            },
            "tools": {
                name: probe(name, root) if probes else {"status": "unprobed", "version": None}
                for name in ("node", "python", "dotnet", "git")
            },
            "project": project,
            "files": names,
            "imports": imports,
            "scripts": scripts,
            "capture": {"limited": limited, "probeEnabled": probes},
        }
    )
