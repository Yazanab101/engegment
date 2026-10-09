import { MAX_CONCURRENT_UPLOADS, isRetryableUploadError } from "./upload-config";
import { MAX_RETRY_ATTEMPTS, retryDelay } from "./retry-backoff";
import {
  loadUploadBlob,
  loadUploadMeta,
  removeUploadBlob,
  removeUploadMeta,
  saveUploadBlob,
  saveUploadMeta,
  type PersistedUpload,
} from "./upload-idb";

export type QueueState =
  | "queued"
  | "compressing"
  | "authorizing"
  | "uploading"
  | "confirming"
  | "completed"
  | "retrying"
  | "waiting_connection"
  | "failed";

export type DirectUploadFile = {
  clientUploadId: string;
  file: Blob;
  thumb: Blob | null;
  previewUrl: string;
  originalFilename: string;
  mimeType: string;
  mediaType: "photo" | "video";
  width?: number | null | undefined;
  height?: number | null | undefined;
  duration?: number | null | undefined;
};

export type QueueItem = DirectUploadFile & {
  state: QueueState;
  progress: number;
  error: string | null;
  uploadId: string | null;
  objectKey: string | null;
  thumbnailObjectKey: string | null;
  uploadedToR2: boolean;
  mediaId: string | null;
  attemptCount: number;
  createdAt: number;
};

type AuthorizeResponse = {
  uploadId: string;
  objectKey: string;
  thumbnailObjectKey: string | null;
  signedUploadUrl: string;
  signedThumbUrl: string | null;
  expiresAt: string;
  uploadSessionId: string;
  alreadyConfirmed: boolean;
};

type ConfirmResponse = {
  mediaId: string;
  status: string;
  duplicate: boolean;
};

export const STATUS_COPY: Record<QueueState, string> = {
  queued: "في الانتظار",
  compressing: "جاري التجهيز...",
  authorizing: "جاري التجهيز...",
  uploading: "جاري الرفع",
  confirming: "جارٍ تأكيد الحفظ...",
  completed: "تم الحفظ 🤍",
  retrying: "إعادة المحاولة",
  waiting_connection: "بانتظار الاتصال...",
  failed: "فشل الرفع",
};

export function queueStatusLabel(item: { state: QueueState; progress: number; mediaType: "photo" | "video" }) {
  if (item.state === "uploading") {
    return item.mediaType === "video"
      ? `جاري رفع الفيديو ${item.progress}%`
      : `${STATUS_COPY.uploading} ${item.progress}%`;
  }
  if ((item.state === "compressing" || item.state === "authorizing") && item.mediaType === "video") {
    return "جاري تجهيز الفيديو...";
  }
  return STATUS_COPY[item.state];
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function parseApi<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => ({}))) as {
    error?: string;
    message?: string;
    retryable?: boolean;
  } & T;
  if (!res.ok) {
    const err = new Error(body.error || body.message || "REQUEST_FAILED") as Error & {
      code: string;
      retryable: boolean;
    };
    err.code = body.error || "REQUEST_FAILED";
    err.retryable = body.retryable ?? res.status >= 500;
    throw err;
  }
  return body;
}

export async function requestUploadUrl(input: {
  deviceToken: string;
  eventId: string;
  uploadSessionId?: string | null;
  clientUploadId: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  mediaType: "photo" | "video";
  hasThumb: boolean;
  table?: string | null;
}) {
  return parseApi<AuthorizeResponse>(
    await fetch("/api/media/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function confirmUpload(input: {
  deviceToken: string;
  uploadId: string;
  objectKey: string;
  fileSize: number;
  mimeType: string;
  width?: number | null | undefined;
  height?: number | null | undefined;
  duration?: number | null | undefined;
  thumbnailObjectKey?: string | null | undefined;
}) {
  return parseApi<ConfirmResponse>(
    await fetch("/api/media/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function requestGuestSignedUrl(deviceToken: string, mediaId: string) {
  return parseApi<{ url: string }>(
    await fetch("/api/media/signed-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceToken, mediaId }),
    }),
  );
}

function putToR2(url: string, blob: Blob, mimeType: string, onProgress: (pct: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", mimeType);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 90));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(Object.assign(new Error("R2_UPLOAD_FAILED"), { retryable: xhr.status >= 500 || xhr.status === 0 }));
    };
    xhr.onerror = () => reject(Object.assign(new Error("NETWORK"), { retryable: true }));
    xhr.send(blob);
  });
}

function persist(item: QueueItem, eventId: string, sessionId: string | null) {
  const row: PersistedUpload = {
    clientUploadId: item.clientUploadId,
    eventId,
    uploadSessionId: sessionId,
    uploadId: item.uploadId,
    objectKey: item.objectKey,
    thumbnailObjectKey: item.thumbnailObjectKey,
    originalFilename: item.originalFilename,
    mimeType: item.mimeType,
    fileSize: item.file.size,
    mediaType: item.mediaType,
    status: item.state,
    uploadedToR2: item.uploadedToR2,
    confirmed: item.state === "completed",
    error: item.error,
    attemptCount: item.attemptCount,
    createdAt: item.createdAt,
    updatedAt: Date.now(),
  };
  void saveUploadMeta(row);
  if (item.state === "completed") {
    void removeUploadBlob(item.clientUploadId);
    return;
  }
  if (item.state !== "failed") void saveUploadBlob(item.clientUploadId, item.file);
}

export function createUploadQueue(options: {
  concurrency?: number;
  deviceToken: () => string;
  eventId: () => string;
  table?: () => string | null;
  onChange: (items: QueueItem[]) => void;
}) {
  const concurrency = options.concurrency ?? MAX_CONCURRENT_UPLOADS;
  let items: QueueItem[] = [];
  let sessionId: string | null = null;
  let running = 0;
  let stopped = false;
  let started = false;
  const isOnline = () => {
    if (typeof navigator === "undefined") return true;
    if (typeof navigator.onLine !== "boolean") return true;
    return navigator.onLine;
  };
  let online = isOnline();
  const inFlight = new Set<string>();

  const emit = () => options.onChange([...items]);

  const setItem = (id: string, patch: Partial<QueueItem>) => {
    items = items.map((item) => (item.clientUploadId === id ? { ...item, ...patch } : item));
    const current = items.find((item) => item.clientUploadId === id);
    if (current) persist(current, options.eventId(), sessionId);
    emit();
  };

  const waitForConnection = () =>
    new Promise<void>((resolve) => {
      if (navigator.onLine) {
        resolve();
        return;
      }
      const done = () => {
        window.removeEventListener("online", done);
        resolve();
      };
      window.addEventListener("online", done);
    });

  async function processOne(item: QueueItem) {
    let attempt = item.attemptCount || 0;
    while (attempt < MAX_RETRY_ATTEMPTS) {
      try {
        if (!isOnline()) {
          setItem(item.clientUploadId, { state: "waiting_connection" });
          await waitForConnection();
        }

        if (!item.uploadedToR2) {
          setItem(item.clientUploadId, { state: attempt ? "retrying" : "authorizing", error: null });
          const auth = await requestUploadUrl({
            deviceToken: options.deviceToken(),
            eventId: options.eventId(),
            uploadSessionId: sessionId,
            clientUploadId: item.clientUploadId,
            originalFilename: item.originalFilename,
            mimeType: item.mimeType,
            fileSize: item.file.size,
            mediaType: item.mediaType,
            hasThumb: Boolean(item.thumb),
            table: options.table?.() ?? null,
          });
          sessionId = auth.uploadSessionId;
          item = {
            ...item,
            uploadId: auth.uploadId,
            objectKey: auth.objectKey,
            thumbnailObjectKey: auth.thumbnailObjectKey,
          };
          setItem(item.clientUploadId, {
            uploadId: auth.uploadId,
            objectKey: auth.objectKey,
            thumbnailObjectKey: auth.thumbnailObjectKey,
          });

          if (auth.alreadyConfirmed) {
            setItem(item.clientUploadId, {
              state: "completed",
              progress: 100,
              mediaId: auth.uploadId,
              uploadedToR2: true,
            });
            void removeUploadMeta(item.clientUploadId);
            return;
          }

          setItem(item.clientUploadId, { state: "uploading", progress: 4 });
          await putToR2(auth.signedUploadUrl, item.file, item.mimeType, (pct) => {
            setItem(item.clientUploadId, { progress: pct, state: "uploading" });
          });
          if (auth.signedThumbUrl && item.thumb) {
            await putToR2(auth.signedThumbUrl, item.thumb, "image/jpeg", () => undefined);
          }
          item = { ...item, uploadedToR2: true };
          setItem(item.clientUploadId, { uploadedToR2: true, progress: 92 });
        }

        setItem(item.clientUploadId, { state: "confirming", progress: 95 });
        const confirmed = await confirmUpload({
          deviceToken: options.deviceToken(),
          uploadId: item.uploadId!,
          objectKey: item.objectKey!,
          fileSize: item.file.size,
          mimeType: item.mimeType,
          width: item.width,
          height: item.height,
          duration: item.duration,
          thumbnailObjectKey: item.thumbnailObjectKey,
        });
        setItem(item.clientUploadId, {
          state: "completed",
          progress: 100,
          mediaId: confirmed.mediaId,
          error: null,
        });
        void removeUploadMeta(item.clientUploadId);
        return;
      } catch (error) {
        const code = error instanceof Error ? error.message : "FAILED";
        const retryable =
          error instanceof Error && "retryable" in error
            ? Boolean((error as { retryable?: boolean }).retryable)
            : isRetryableUploadError(code);
        attempt += 1;
        setItem(item.clientUploadId, { attemptCount: attempt, error: code });
        item = { ...item, attemptCount: attempt };
        if (!retryable || attempt >= MAX_RETRY_ATTEMPTS) {
          setItem(item.clientUploadId, { state: "failed", error: code });
          return;
        }
        setItem(item.clientUploadId, { state: "retrying", error: code });
        await sleep(retryDelay(attempt - 1));
      }
    }
  }

  async function pump() {
    if (stopped) return;
    while (running < concurrency) {
      const next = items.find(
        (item) =>
          ["queued", "retrying", "waiting_connection"].includes(item.state) &&
          !inFlight.has(item.clientUploadId) &&
          (item.state !== "waiting_connection" || online),
      );
      if (!next) break;
      running += 1;
      inFlight.add(next.clientUploadId);
      setItem(next.clientUploadId, {
        state: next.state === "queued" || next.state === "retrying" ? "authorizing" : next.state,
      });
      void processOne(next).finally(() => {
        inFlight.delete(next.clientUploadId);
        running -= 1;
        void pump();
      });
    }
  }

  const onOnline = () => {
    online = true;
    items = items.map((item) =>
      item.state === "waiting_connection" ? { ...item, state: "retrying" } : item,
    );
    emit();
    void pump();
  };
  const onOffline = () => {
    online = false;
    items = items.map((item) =>
      item.state === "uploading" || item.state === "authorizing" || item.state === "confirming"
        ? { ...item, state: "waiting_connection" }
        : item,
    );
    emit();
  };

  if (typeof window !== "undefined") {
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
  }

  return {
    getItems: () => items,
    getSessionId: () => sessionId,
    add(files: DirectUploadFile[]) {
      const seen = new Set(items.map((item) => item.clientUploadId));
      const incoming: QueueItem[] = files
        .filter((file) => {
          if (seen.has(file.clientUploadId)) return false;
          seen.add(file.clientUploadId);
          return true;
        })
        .map((file) => ({
          ...file,
          state: "queued" as const,
          progress: 0,
          error: null,
          uploadId: null,
          objectKey: null,
          thumbnailObjectKey: null,
          uploadedToR2: false,
          mediaId: null,
          attemptCount: 0,
          createdAt: Date.now(),
        }));
      if (!incoming.length) return;
      items = [...items, ...incoming];
      for (const item of incoming) persist(item, options.eventId(), sessionId);
      emit();
      started = true;
      void pump();
    },
    async restore() {
      const rows = await loadUploadMeta();
      const restored: QueueItem[] = [];
      for (const row of rows) {
        if (row.confirmed) {
          void removeUploadMeta(row.clientUploadId);
          continue;
        }
        const blob = await loadUploadBlob(row.clientUploadId);
        if (!blob && !row.uploadedToR2) continue;
        const file = blob ?? new Blob([], { type: row.mimeType });
        restored.push({
          clientUploadId: row.clientUploadId,
          file,
          thumb: null,
          previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : "",
          originalFilename: row.originalFilename,
          mimeType: row.mimeType,
          mediaType: row.mediaType,
          state: "queued",
          progress: row.uploadedToR2 ? 92 : 0,
          error: null,
          uploadId: row.uploadId,
          objectKey: row.objectKey,
          thumbnailObjectKey: row.thumbnailObjectKey,
          uploadedToR2: row.uploadedToR2,
          mediaId: null,
          attemptCount: row.attemptCount ?? 0,
          createdAt: row.createdAt ?? row.updatedAt,
        });
        if (row.uploadSessionId) sessionId = row.uploadSessionId;
      }
      if (!restored.length) return;
      items = [...restored, ...items];
      emit();
      started = true;
      void pump();
    },
    remove(clientUploadId: string) {
      const current = items.find((item) => item.clientUploadId === clientUploadId);
      if (current && ["uploading", "authorizing", "confirming"].includes(current.state)) return;
      items = items.filter((item) => item.clientUploadId !== clientUploadId);
      void removeUploadMeta(clientUploadId);
      emit();
    },
    start() {
      stopped = false;
      started = true;
      online = isOnline();
      if (!online) {
        items = items.map((item) =>
          item.state === "queued" ? { ...item, state: "waiting_connection" } : item,
        );
        emit();
      }
      void pump();
    },
    retryFailed() {
      items = items.map((item) =>
        item.state === "failed" ? { ...item, state: "queued", error: null, progress: 0 } : item,
      );
      emit();
      void pump();
    },
    clearCompleted() {
      items = items.filter((item) => item.state !== "completed");
      emit();
    },
    whenIdle() {
      return new Promise<void>((resolve) => {
        const tick = () => {
          const pending = items.some((item) => !["completed", "failed"].includes(item.state));
          if (!pending && running === 0) resolve();
          else setTimeout(tick, 120);
        };
        tick();
      });
    },
    dispose() {
      stopped = true;
      void started;
      if (typeof window !== "undefined") {
        window.removeEventListener("online", onOnline);
        window.removeEventListener("offline", onOffline);
      }
    },
  };
}
