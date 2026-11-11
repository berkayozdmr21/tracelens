export type Snapshot = {
  schemaVersion: number;
  label: string;
  platform: { system: string; arch: string; caseSensitive: boolean | null };
  tools: Record<string, { status: string; version: string | null }>;
  project: {
    name: string;
    engines: Record<string, string>;
    frameworks: string[];
    packageManager: string;
    dependencies: { name: string; version: string; kind: string }[];
    env: { name: string; defined: boolean }[];
    locks: { file: string; sha256: string }[];
  };
  files: string[];
  imports: {
    file: string;
    line: number;
    spec: string;
    target: string | null;
    caseMismatch: boolean;
  }[];
  scripts: { file: string; crlf: boolean }[];
  capture: { limited: boolean; probeEnabled: boolean };
};
export type Finding = {
  id: string;
  rule: string;
  title: string;
  severity: "error" | "warning" | "info";
  category: string;
  confidence: string;
  facts: string[];
  steps: string[];
  paths: string[];
  logEvidence: LogRow[];
};
export type LogRow = { line: number; text: string; time: string | null };
export type Summary = {
  errors: number;
  warnings: number;
  info: number;
  unknowns: number;
  rulesTriggered: number;
  logErrors: number;
};
export type Report = {
  summary: Summary;
  leftLabel: string;
  rightLabel: string;
  findings: Finding[];
  timeline: LogRow[];
  unknowns: string[];
  snapshots: { left: Snapshot; right: Snapshot };
  redactedLog: string;
  scope: string;
};
export type Card = {
  id: string;
  title: string;
  createdAt: string;
  archived: boolean;
  leftLabel: string;
  rightLabel: string;
  summary: Summary;
  resolved: number;
};
export type Detail = {
  revision: number;
  id: string;
  title: string;
  createdAt: string;
  archived: boolean;
  notes: string;
  report: Report;
  resolutions: Record<string, boolean>;
};
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const r = await fetch("/api" + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.ok) {
    const data = await r
      .json()
      .catch(() => ({ error: "Yerel servise ulaşılamıyor." }));
    throw new Error(data.error || "İşlem tamamlanamadı.");
  }
  return r.json();
}
export const categories: Record<string, string> = {
  runtime: "Çalışma zamanı",
  configuration: "Yapılandırma",
  dependencies: "Bağımlılıklar",
  filesystem: "Dosya sistemi",
  platform: "Platform",
};
export const severity: Record<string, string> = {
  error: "Kritik",
  warning: "Uyarı",
  info: "Bilgi",
};
export const confidence: Record<string, string> = {
  high: "Yüksek kanıt",
  medium: "İncelenmeli",
  low: "Olası etken",
};
export const date = (value: string) =>
  new Date(value).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
export function download(name: string, text: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
