/** Shared upload limits and MIME allowlists. Safe to import from client and server. */

export const MAX_CONCURRENT_UPLOADS = 3;

export const IMAGE_MAX_SIZE_MB = 20;
export const VIDEO_MAX_SIZE_MB = 250;

export const IMAGE_MAX_BYTES = IMAGE_MAX_SIZE_MB * 1024 * 1024;
export const VIDEO_MAX_BYTES = VIDEO_MAX_SIZE_MB * 1024 * 1024;

/** Longest edge after client optimization (within 2560–3000). */
export const IMAGE_MAX_EDGE = 2800;
/** Skip recompression when already small enough. */
export const IMAGE_SKIP_COMPRESS_BYTES = 1.5 * 1024 * 1024;
export const IMAGE_OUTPUT_QUALITY = 0.85;
export const THUMB_MAX_EDGE = 640;
export const THUMB_QUALITY = 0.72;

export const PRESIGN_TTL_SECONDS = 8 * 60;
export const DOWNLOAD_TTL_SECONDS = 10 * 60;
export const STALE_PENDING_MS = 24 * 60 * 60 * 1000;

export const UPLOAD_AUTH_LIMIT_PER_MINUTE = 60;
export const MESSAGE_LIMIT_PER_10_MIN = 15;
export const ADMIN_LIMIT_PER_MINUTE = 120;

export const IMAGE_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/gif": "gif",
};

export const VIDEO_MIME: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "video/3gpp": "3gp",
  "video/x-matroska": "mkv",
};

export const BLOCKED_MIME = new Set([
  "text/html",
  "application/xhtml+xml",
  "image/svg+xml",
  "application/javascript",
  "text/javascript",
  "application/x-msdownload",
  "application/x-executable",
  "application/wasm",
]);

export type MediaKind = "photo" | "video";
export type StorageProvider = "r2" | "legacy";
export type UploadStatus =
  | "pending"
  | "uploading"
  | "uploaded"
  | "confirmed"
  | "failed"
  | "deleted"
  | "ready";

export const VISIBLE_MEDIA_STATUSES = ["confirmed", "ready"] as const;

export function normalizeMime(raw: string): string {
  return (raw.toLowerCase().split(";")[0] ?? "").trim();
}

export function classifyMime(mime: string): { kind: MediaKind; ext: string } | null {
  const clean = normalizeMime(mime);
  if (BLOCKED_MIME.has(clean)) return null;
  if (clean in IMAGE_MIME) return { kind: "photo", ext: IMAGE_MIME[clean]! };
  if (clean in VIDEO_MIME) return { kind: "video", ext: VIDEO_MIME[clean]! };
  return null;
}

export function isRetryableUploadError(code: string): boolean {
  return ![
    "UNSUPPORTED_TYPE",
    "FILE_TOO_LARGE",
    "UPLOADS_CLOSED",
    "UNAUTHORIZED",
    "GUEST_NOT_FOUND",
    "SESSION_MISMATCH",
    "INVALID_OBJECT_KEY",
  ].includes(code);
}

export class UploadError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly httpStatus: number;

  constructor(code: string, message: string, httpStatus = 400) {
    super(message);
    this.name = "UploadError";
    this.code = code;
    this.retryable = isRetryableUploadError(code);
    this.httpStatus = httpStatus;
  }
}

export function jsonUploadError(error: unknown) {
  if (error instanceof UploadError) {
    return Response.json(
      { error: error.code, message: error.message, retryable: error.retryable },
      { status: error.httpStatus },
    );
  }
  return Response.json({ error: "INTERNAL", message: "Unexpected error", retryable: true }, { status: 500 });
}
