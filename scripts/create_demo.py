import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]


def example(label, system, arch, case, node, dotnet, defined, react, sha):
    return {
        "schemaVersion": 1,
        "label": label,
        "platform": {"system": system, "arch": arch, "caseSensitive": case},
        "tools": {
            "node": {"status": "available", "version": node},
            "dotnet": {"status": "available", "version": dotnet},
            "python": {"status": "available", "version": "3.12.9"},
            "git": {"status": "available", "version": "2.44.0"},
        },
        "project": {
            "name": "checkout-studio",
            "engines": {"node": ">=22 <25"},
            "frameworks": ["net10.0"],
            "packageManager": "npm@10.8.2",
            "dependencies": [
                {"name": "react", "version": react, "kind": "dependencies"},
                {"name": "vite", "version": "7.3.7", "kind": "devDependencies"},
            ],
            "env": [
                {"name": "DATABASE_URL", "defined": defined},
                {"name": "PUBLIC_API_BASE", "defined": True},
            ],
            "locks": [{"file": "package-lock.json", "sha256": sha * 64}],
        },
        "files": [
            "web/main.ts",
            "web/services/userService.ts",
            "scripts/verify.sh",
            "api/Checkout.csproj",
        ],
        "imports": [
            {
                "file": "web/main.ts",
                "line": 12,
                "spec": "./services/UserService",
                "target": "web/services/userService.ts",
                "caseMismatch": True,
            }
        ],
        "scripts": [{"file": "scripts/verify.sh", "crlf": True}],
        "capture": {"limited": False, "probeEnabled": False},
    }


left = example(
    "Local / Windows", "Windows", "x86_64", False, "24.1.0", "10.0.402", True, "19.3.1", "a"
)
right = example("CI / Linux", "Linux", "aarch64", True, "20.19.0", "8.0.405", False, "19.2.0", "b")
log = """2026-11-10T09:14:01Z INFO Checkout verification started
2026-11-10T09:14:02Z npm WARN EBADENGINE required node >=22, current node v20.19.0
2026-11-10T09:14:03Z web/main.ts(12,29): error TS2307: Cannot find module './services/UserService'
2026-11-10T09:14:04Z error NETSDK1045: The current .NET SDK does not support targeting .NET 10.0
2026-11-10T09:14:05Z ERROR DATABASE_URL is not configured
2026-11-10T09:14:06Z scripts/verify.sh: bad interpreter: /bin/bash^M: not found
2026-11-10T09:14:07Z ERROR Verification failed
"""
for name, value in [
    ("left.snapshot.json", left),
    ("right.snapshot.json", right),
    ("demo-input.json", {"left": left, "right": right, "log": log}),
]:
    (root / "examples" / name).write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
(root / "examples/ci.redacted.log").write_text(log, encoding="utf-8")
