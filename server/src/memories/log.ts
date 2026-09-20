type LogFields = Record<string, string | number | boolean | null | undefined>;

const REDACT = /secret|token|authorization|password|signed|url|key/i;

export function logUpload(event: string, fields: LogFields) {
  const safe: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (REDACT.test(k)) continue;
    if (v === undefined) continue;
    safe[k] = v;
  }
  console.info(JSON.stringify({ scope: "media-upload", event, ...safe, ts: new Date().toISOString() }));
}

export function logUploadError(event: string, error: unknown, fields: LogFields = {}) {
  const message = error instanceof Error ? error.message : "unknown";
  logUpload(event, { ...fields, error: message });
}
