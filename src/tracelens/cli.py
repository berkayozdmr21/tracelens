import argparse
import io
import json
import subprocess
import sys
import zipfile
from pathlib import Path
from .analysis import analyze, context_prompt
from .collector import capture
from .security import clean
from . import __version__


def read_json(path):
    raw = Path(path).read_bytes()
    if len(raw) > 4_000_000:
        raise ValueError("Snapshot input exceeds 4 MB.")
    return json.loads(raw.decode("utf-8-sig"))


def bundle(report):
    result = io.BytesIO()
    with zipfile.ZipFile(result, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("report.json", json.dumps(report, ensure_ascii=False, indent=2))
        z.writestr(
            "left.snapshot.json",
            json.dumps(report["snapshots"]["left"], ensure_ascii=False, indent=2),
        )
        z.writestr(
            "right.snapshot.json",
            json.dumps(report["snapshots"]["right"], ensure_ascii=False, indent=2),
        )
        z.writestr("log.redacted.txt", report["redactedLog"])
        z.writestr("contextpilot-handoff.md", context_prompt(report))
        z.writestr(
            "READ-BEFORE-SHARING.txt",
            "Metadata can reveal project paths and dependency names. Redaction is best effort. Review all files before sharing. No source code or environment values are intentionally collected.\n",
        )
    return result.getvalue()


def main(argv=None):
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(
        prog="tracelens",
        description="Local environment drift diagnostics. No project hooks or automatic fixes.",
    )
    parser.add_argument("--version", action="version", version=__version__)
    sub = parser.add_subparsers(dest="command", required=True)
    p = sub.add_parser("capture")
    p.add_argument("--root", default=".")
    p.add_argument("--label", default="Local environment")
    p.add_argument("--no-probe", action="store_true")
    p.add_argument("--out", required=True)
    for name in ("compare", "bundle"):
        p = sub.add_parser(name)
        p.add_argument("left")
        p.add_argument("right")
        p.add_argument("--log")
        p.add_argument("--out", required=True)
    sub.add_parser("analyze-input", help="Bounded JSON stdin protocol for the local API")
    p = sub.add_parser("context")
    p.add_argument("report")
    p.add_argument("--out", required=True)
    p.add_argument("--root")
    p.add_argument(
        "--contextpilot",
        help="Explicit trusted ContextPilot scripts/run.py path; never executed by the web API",
    )
    args = parser.parse_args(argv)
    try:
        if args.command == "analyze-input":
            raw = sys.stdin.buffer.read(4_000_001)
            if len(raw) > 4_000_000:
                raise ValueError("Diagnostic input exceeds 4 MB.")
            data = json.loads(raw.decode("utf-8-sig"))
            result = analyze(data["left"], data["right"], data.get("log", ""))
            print(json.dumps(result, ensure_ascii=False))
            return 0
        target = Path(args.out)
        if target.exists():
            raise ValueError("Output exists; choose a new filename.")
        if args.command == "capture":
            result = capture(args.root, args.label, not args.no_probe)
        elif args.command in ("compare", "bundle"):
            log = (
                Path(args.log).read_text(encoding="utf-8-sig", errors="replace") if args.log else ""
            )
            if len(log) > 1_000_000:
                raise ValueError("Log exceeds one million characters.")
            result = analyze(read_json(args.left), read_json(args.right), log)
            if args.command == "bundle":
                target.write_bytes(bundle(result))
                print(str(target.resolve()))
                return 0
        else:
            report = read_json(args.report)
            result = context_prompt(report)
            if args.contextpilot:
                if not args.root:
                    raise ValueError("--root is required with --contextpilot.")
                helper = Path(args.contextpilot).resolve()
                if not helper.is_file():
                    raise ValueError("ContextPilot helper not found.")
                query = (
                    " ".join(sorted({p for f in report["findings"] for p in f["paths"] if p}))
                    or "runtime configuration dependency versions"
                )
                proc = subprocess.run(
                    [
                        sys.executable,
                        str(helper),
                        "pack",
                        query,
                        "--root",
                        str(Path(args.root).resolve()),
                        "--with-dependencies",
                        "--max-chars",
                        "6000",
                    ],
                    capture_output=True,
                    encoding="utf-8",
                    timeout=30,
                )
                if proc.returncode:
                    raise ValueError(
                        "ContextPilot failed; verify the trusted helper and project root."
                    )
                result += "\n# Local source excerpts — review before sharing\n" + proc.stdout
            target.write_text(result, encoding="utf-8")
            print(str(target.resolve()))
            return 0
        target.write_text(
            json.dumps(clean(result), ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        print(str(target.resolve()))
        return 0
    except (
        ValueError,
        OSError,
        KeyError,
        TypeError,
        AttributeError,
        subprocess.TimeoutExpired,
    ) as e:
        message = (
            str(e)
            if isinstance(e, ValueError)
            else "Invalid diagnostic input or unavailable local file."
        )
        if args.command == "analyze-input":
            print(json.dumps({"error": message}))
            return 2
        print("tracelens: " + message, file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
