import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const base = process.env.API_URL || "http://127.0.0.1:9281";
async function api(path, method = "GET", body, status = 200, headers = {}) {
  const r = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json();
  assert.equal(r.status, status, JSON.stringify(data));
  return data;
}
test("case workflow persists notes, resolutions and archive state with revision protection", async () => {
  const row = await api("/api/cases/demo", "POST");
  assert.equal(row.report.summary.errors, 4);
  assert.equal(row.report.findings.length, 10);
  assert.equal(row.revision, 1);
  const finding = row.report.findings[0];
  let saved = await api(
    "/api/cases/" + row.id + "/findings/" + finding.id,
    "PUT",
    { resolved: true, revision: row.revision },
  );
  assert.equal(saved.resolutions[finding.id], true);
  await api(
    "/api/cases/" + row.id + "/findings/" + finding.id,
    "PUT",
    { resolved: false, revision: row.revision },
    409,
  );
  saved = await api("/api/cases/" + row.id, "PATCH", {
    title: "Verified API case",
    notes: "Local note excluded from bundle",
    archived: false,
    revision: saved.revision,
  });
  const loaded = await api("/api/cases/" + row.id);
  assert.equal(loaded.notes, "Local note excluded from bundle");
  assert.equal(loaded.resolutions[finding.id], true);
  const zip = await fetch(base + "/api/cases/" + row.id + "/export");
  assert.equal(zip.status, 200);
  assert.match(zip.headers.get("content-type"), /zip/);
  assert.ok((await zip.arrayBuffer()).byteLength > 1000);
  const handoff = await fetch(base + "/api/cases/" + row.id + "/handoff");
  assert.match(await handoff.text(), /filesystem.case/);
  saved = await api("/api/cases/" + row.id, "PATCH", {
    title: saved.title,
    notes: saved.notes,
    archived: true,
    revision: saved.revision,
  });
  assert.ok(!(await api("/api/cases")).some((c) => c.id === row.id));
  assert.ok(
    (await api("/api/cases?archived=true")).some((c) => c.id === row.id),
  );
  await api("/api/cases/" + row.id, "PATCH", {
    title: saved.title,
    notes: saved.notes,
    archived: false,
    revision: saved.revision,
  });
});
test("validation, redaction and local origin boundaries", async () => {
  const example = JSON.parse(
    await readFile("examples/demo-input.json", "utf8"),
  );
  const key = "sk-" + "a".repeat(30);
  const row = await api("/api/cases", "POST", {
    title: "Redaction check",
    ...example,
    log: "ERROR api_key=" + key + "\nBearer " + "z".repeat(25),
  });
  assert.ok(!JSON.stringify(row).includes(key));
  assert.ok(row.report.redactedLog.includes("[REDACTED]"));
  const invalid = structuredClone(example);
  invalid.right.files = ["../escape.ts"];
  await api("/api/cases", "POST", { title: "Invalid", ...invalid }, 400);
  await api("/api/cases", "POST", { title: "Missing snapshots" }, 400);
  await api(
    "/api/cases",
    "POST",
    { title: "Invalid", left: { schemaVersion: 99 }, right: example.right },
    400,
  );
  await api("/api/cases/demo", "POST", undefined, 403, {
    Origin: "https://untrusted.example",
  });
  await api("/api/cases/not-a-case", "GET", undefined, 404);
});
