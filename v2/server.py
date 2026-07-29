#!/usr/bin/env python3
"""Local-only companion to extract.py: lets the running dashboard upload a CSV and
classify it without a rebuild, instead of editing SOURCES and running extract.py by hand.

Only ever binds to localhost. Reuses extract.py's parsing/classification functions rather
than duplicating them, so the CLI batch workflow (`python3 extract.py`) and this server
stay in sync automatically. Stdlib only, matching extract.py's own convention.

Run alongside `npm run dev`:
    python3 server.py
"""
import csv
import io
import json
import threading
import urllib.parse
import urllib.request
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import extract

PORT = 8787
MAX_UPLOAD_BYTES = 50 * 1024 * 1024
DATA_PATH = extract.DATA_PATH
CACHE_PATH = extract.CACHE_PATH

# job_id -> {status, processed, total, owner, message}
# status: "detecting" | "checking_ollama" | "parsing" | "classifying" | "done" | "error"
JOBS: dict[str, dict] = {}


def detect_owner_name(rows: list[dict], sample_size: int = 300) -> str | None:
    """The account owner's name is the one sender that recurs across nearly every row's
    conversation — every other name only appears within its own single row. Tally sender
    names with extract.py's own regex over a sample and return the most frequent."""
    from collections import Counter

    counts = Counter()
    seen = 0
    for row in rows:
        history = (row.get("full_messaging_history") or "").replace("\xa0", " ")
        if not history.strip():
            continue
        for m in extract._MSG_RE.finditer(history):
            counts[m.group(1).strip()] += 1
        seen += 1
        if seen >= sample_size:
            break
    return counts.most_common(1)[0][0] if counts else None


def ollama_reachable() -> bool:
    try:
        with urllib.request.urlopen("http://localhost:11434/api/version", timeout=3):
            return True
    except Exception:
        return False


def run_job(job_id: str, csv_bytes: bytes, owner_hint: str | None) -> None:
    job = JOBS[job_id]
    try:
        job["status"] = "detecting"
        text = csv_bytes.decode("utf-8")
        rows = list(csv.DictReader(io.StringIO(text)))

        owner = owner_hint or detect_owner_name(rows)
        if not owner:
            raise RuntimeError("Could not detect an owner name and none was provided.")
        job["owner"] = owner

        job["status"] = "checking_ollama"
        if not ollama_reachable():
            raise RuntimeError(
                "Could not reach Ollama at http://localhost:11434 — is it running? "
                "Try: brew services start ollama"
            )

        job["status"] = "parsing"
        parsed = []
        for row in rows:
            conv = extract.build_conversation(row, owner)
            if conv is None:
                continue
            conv["owner"] = owner
            parsed.append(conv)

        replied = [c for c in parsed if c["replied"]]
        job["total"] = len(replied)
        job["processed"] = 0
        job["status"] = "classifying"

        cache = json.loads(CACHE_PATH.read_text()) if CACHE_PATH.exists() else {}
        for conv in parsed:
            if conv["replied"]:
                result = extract.classify_reply(conv, cache)
                conv["sentiment"] = result["sentiment"]
                conv["tags"] = result["tags"]
                job["processed"] += 1
                if job["processed"] % 5 == 0:
                    CACHE_PATH.write_text(json.dumps(cache, ensure_ascii=False, indent=2))
            else:
                conv["sentiment"] = None
                conv["tags"] = []
        CACHE_PATH.write_text(json.dumps(cache, ensure_ascii=False, indent=2))

        # Shared with main()'s CLI batch path, so a CLI run for a different profile can
        # never silently delete this one, or vice versa.
        extract.merge_and_write(parsed, owners_replaced={owner})

        job["status"] = "done"
        job["message"] = f"{len(parsed)} conversations added for {owner} ({len(replied)} replies classified)"
    except Exception as e:
        job["status"] = "error"
        job["message"] = str(e)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print(f"{self.command} {self.path} -> {args[1] if len(args) > 1 else ''}")

    def _cors(self):
        # Local-only tool reachable solely from this machine — not worth distinguishing
        # the Vite dev origin from a file:// origin (sent as "null") for the built dist.
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _send_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload).encode()
        self.send_response(status)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/data":
            if not DATA_PATH.exists():
                self._send_json(404, {"error": "data.json does not exist yet"})
                return
            body = DATA_PATH.read_bytes()
            self.send_response(200)
            self._cors()
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        if parsed.path.startswith("/api/jobs/"):
            job_id = parsed.path.removeprefix("/api/jobs/")
            job = JOBS.get(job_id)
            if job is None:
                self._send_json(404, {"error": "unknown job id"})
                return
            self._send_json(200, job)
            return

        self._send_json(404, {"error": "not found"})

    def _read_csv_body(self) -> bytes | None:
        """Validates Content-Length against the cap and reads the body, or sends an error
        response and returns None. Shared by /api/upload and /api/detect-owner so both
        enforce the same 50MB limit the same way."""
        length = int(self.headers.get("Content-Length", 0))
        if length <= 0:
            self._send_json(400, {"error": "empty upload"})
            return None
        if length > MAX_UPLOAD_BYTES:
            self._send_json(413, {"error": f"file exceeds {MAX_UPLOAD_BYTES // (1024 * 1024)}MB limit"})
            return None
        return self.rfile.read(length)

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)

        if parsed.path == "/api/detect-owner":
            # Synchronous and fast (a regex pass over a row sample, no Ollama call) so the
            # frontend can show the guessed owner name for editing *before* a job — which
            # bakes the owner into every parsed conversation — ever starts.
            csv_bytes = self._read_csv_body()
            if csv_bytes is None:
                return
            rows = list(csv.DictReader(io.StringIO(csv_bytes.decode("utf-8"))))
            self._send_json(200, {"owner": detect_owner_name(rows)})
            return

        if parsed.path == "/api/upload":
            csv_bytes = self._read_csv_body()
            if csv_bytes is None:
                return
            owner_hint = urllib.parse.parse_qs(parsed.query).get("owner", [None])[0]

            job_id = uuid.uuid4().hex
            JOBS[job_id] = {"status": "queued", "processed": 0, "total": 0, "owner": owner_hint, "message": ""}
            threading.Thread(target=run_job, args=(job_id, csv_bytes, owner_hint), daemon=True).start()
            self._send_json(202, {"job_id": job_id})
            return

        self._send_json(404, {"error": "not found"})


def main() -> None:
    server = ThreadingHTTPServer(("localhost", PORT), Handler)
    print(f"Upload server on http://localhost:{PORT} — Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
