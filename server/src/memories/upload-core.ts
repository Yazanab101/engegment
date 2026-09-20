import {
  IMAGE_MAX_BYTES,
  PRESIGN_TTL_SECONDS,
  STALE_PENDING_MS,
  VIDEO_MAX_BYTES,
  VISIBLE_MEDIA_STATUSES,
  UploadError,
  classifyMime,
  type MediaKind,
  type StorageProvider,
  type UploadStatus,
} from "./upload-config.js";

export type PendingUpload = {
  uploadId: string;
  clientUploadId: string;
  eventId: string;
  guestId: string;
  uploadSessionId: string;
  objectKey: string;
  thumbnailObjectKey: string | null;
  mediaType: MediaKind;
  mimeType: string;
  fileSize: number;
  status: UploadStatus;
  storageProvider: StorageProvider;
  width: number | null;
  height: number | null;
  duration: number | null;
  createdAt: string;
  confirmedAt: string | null;
};

export type AuthorizeInput = {
  eventId: string;
  guestId: string;
  uploadSessionId: string;
  clientUploadId: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  mediaType: MediaKind;
  hasThumb: boolean;
};

export type ConfirmInput = {
  uploadId: string;
  guestId: string;
  objectKey: string;
  fileSize: number;
  mimeType: string;
  width?: number | null | undefined;
  height?: number | null | undefined;
  duration?: number | null | undefined;
  thumbnailObjectKey?: string | null | undefined;
};

export type EventRecord = {
  id: string;
  uploadsOpen: boolean;
};

export type SessionRecord = {
  id: string;
  eventId: string;
  guestId: string;
};

export type UploadRepository = {
  getEvent(eventId: string): Promise<EventRecord | null>;
  getSession(sessionId: string): Promise<SessionRecord | null>;
  findByClientUploadId(clientUploadId: string, guestId: string): Promise<PendingUpload | null>;
  findByUploadId(uploadId: string): Promise<PendingUpload | null>;
  insertPending(row: PendingUpload): Promise<PendingUpload>;
  updateStatus(uploadId: string, status: UploadStatus, patch?: Partial<PendingUpload>): Promise<PendingUpload>;
  listStalePending(beforeIso: string): Promise<PendingUpload[]>;
  markDeleted(uploadId: string): Promise<void>;
};

export type ObjectSigner = {
  signPut(objectKey: string, mimeType: string, expiresIn: number): Promise<string>;
};

export function buildObjectKeys(input: {
  eventId: string;
  guestId: string;
  uploadSessionId: string;
  ext: string;
  hasThumb: boolean;
}) {
  const uuid = crypto.randomUUID();
  const base = `events/${input.eventId}/guests/${input.guestId}/${input.uploadSessionId}/${uuid}`;
  return {
    objectKey: `${base}.${input.ext}`,
    thumbnailObjectKey: input.hasThumb ? `${base}-thumb.jpg` : null,
    uploadId: uuid,
  };
}

export function assertOwnedKey(objectKey: string, eventId: string, guestId: string, sessionId: string) {
  const prefix = `events/${eventId}/guests/${guestId}/${sessionId}/`;
  if (!objectKey.startsWith(prefix) || objectKey.includes("..")) {
    throw new UploadError("INVALID_OBJECT_KEY", "Object key does not belong to this guest", 403);
  }
}

function extensionFromName(name: string): string {
  const part = name.split(".").pop()?.toLowerCase() ?? "";
  if (!part || part.length > 8 || /[^a-z0-9]/.test(part)) return "";
  return part;
}

export async function authorizeUpload(
  repo: UploadRepository,
  signer: ObjectSigner,
  input: AuthorizeInput,
): Promise<{
  uploadId: string;
  objectKey: string;
  thumbnailObjectKey: string | null;
  signedUploadUrl: string;
  signedThumbUrl: string | null;
  expiresAt: string;
  alreadyConfirmed: boolean;
}> {
  const event = await repo.getEvent(input.eventId);
  if (!event) throw new UploadError("NOT_FOUND", "Event not found", 404);
  if (event.id !== input.eventId) throw new UploadError("NOT_FOUND", "Event mismatch", 404);
  if (!event.uploadsOpen) throw new UploadError("UPLOADS_CLOSED", "Uploads are closed", 403);

  const session = await repo.getSession(input.uploadSessionId);
  if (!session || session.guestId !== input.guestId || session.eventId !== input.eventId) {
    throw new UploadError("SESSION_MISMATCH", "Upload session does not belong to this guest", 403);
  }

  const classified = classifyMime(input.mimeType);
  if (!classified) throw new UploadError("UNSUPPORTED_TYPE", "File type is not allowed", 400);
  if (classified.kind !== input.mediaType) {
    throw new UploadError("UNSUPPORTED_TYPE", "mediaType does not match MIME type", 400);
  }
  if (classified.kind === "photo" && input.fileSize > IMAGE_MAX_BYTES) {
    throw new UploadError("FILE_TOO_LARGE", "Image exceeds the allowed size", 400);
  }
  if (classified.kind === "video" && input.fileSize > VIDEO_MAX_BYTES) {
    throw new UploadError("FILE_TOO_LARGE", "Video exceeds the allowed size", 400);
  }

  const existing = await repo.findByClientUploadId(input.clientUploadId, input.guestId);
  const expiresAt = new Date(Date.now() + PRESIGN_TTL_SECONDS * 1000).toISOString();

  if (existing) {
    if (existing.eventId !== input.eventId || existing.guestId !== input.guestId) {
      throw new UploadError("UNAUTHORIZED", "Upload does not belong to this guest", 403);
    }
    if (VISIBLE_MEDIA_STATUSES.includes(existing.status as (typeof VISIBLE_MEDIA_STATUSES)[number])) {
      return {
        uploadId: existing.uploadId,
        objectKey: existing.objectKey,
        thumbnailObjectKey: existing.thumbnailObjectKey,
        signedUploadUrl: "",
        signedThumbUrl: null,
        expiresAt,
        alreadyConfirmed: true,
      };
    }
    const signedUploadUrl = await signer.signPut(existing.objectKey, existing.mimeType, PRESIGN_TTL_SECONDS);
    const signedThumbUrl = existing.thumbnailObjectKey
      ? await signer.signPut(existing.thumbnailObjectKey, "image/jpeg", PRESIGN_TTL_SECONDS)
      : null;
    if (existing.status === "failed") {
      await repo.updateStatus(existing.uploadId, "pending");
    }
    return {
      uploadId: existing.uploadId,
      objectKey: existing.objectKey,
      thumbnailObjectKey: existing.thumbnailObjectKey,
      signedUploadUrl,
      signedThumbUrl,
      expiresAt,
      alreadyConfirmed: false,
    };
  }

  const ext = classified.ext || extensionFromName(input.originalFilename) || (classified.kind === "photo" ? "jpg" : "mp4");
  const keys = buildObjectKeys({
    eventId: input.eventId,
    guestId: input.guestId,
    uploadSessionId: input.uploadSessionId,
    ext,
    hasThumb: input.hasThumb && classified.kind === "photo" ? true : input.hasThumb,
  });
  assertOwnedKey(keys.objectKey, input.eventId, input.guestId, input.uploadSessionId);

  const now = new Date().toISOString();
  const row: PendingUpload = {
    uploadId: keys.uploadId,
    clientUploadId: input.clientUploadId,
    eventId: input.eventId,
    guestId: input.guestId,
    uploadSessionId: input.uploadSessionId,
    objectKey: keys.objectKey,
    thumbnailObjectKey: keys.thumbnailObjectKey,
    mediaType: classified.kind,
    mimeType: normalizeOrMime(input.mimeType),
    fileSize: input.fileSize,
    status: "pending",
    storageProvider: "r2",
    width: null,
    height: null,
    duration: null,
    createdAt: now,
    confirmedAt: null,
  };

  let saved: PendingUpload;
  try {
    saved = await repo.insertPending(row);
  } catch (error) {
    const raced = await repo.findByClientUploadId(input.clientUploadId, input.guestId);
    if (raced) {
      const signedUploadUrl = raced.status === "confirmed" || raced.status === "ready"
        ? ""
        : await signer.signPut(raced.objectKey, raced.mimeType, PRESIGN_TTL_SECONDS);
      return {
        uploadId: raced.uploadId,
        objectKey: raced.objectKey,
        thumbnailObjectKey: raced.thumbnailObjectKey,
        signedUploadUrl,
        signedThumbUrl:
          raced.thumbnailObjectKey && signedUploadUrl
            ? await signer.signPut(raced.thumbnailObjectKey, "image/jpeg", PRESIGN_TTL_SECONDS)
            : null,
        expiresAt,
        alreadyConfirmed: raced.status === "confirmed" || raced.status === "ready",
      };
    }
    throw error;
  }

  const signedUploadUrl = await signer.signPut(saved.objectKey, saved.mimeType, PRESIGN_TTL_SECONDS);
  const signedThumbUrl = saved.thumbnailObjectKey
    ? await signer.signPut(saved.thumbnailObjectKey, "image/jpeg", PRESIGN_TTL_SECONDS)
    : null;

  return {
    uploadId: saved.uploadId,
    objectKey: saved.objectKey,
    thumbnailObjectKey: saved.thumbnailObjectKey,
    signedUploadUrl,
    signedThumbUrl,
    expiresAt,
    alreadyConfirmed: false,
  };
}

function normalizeOrMime(raw: string) {
  return (raw.toLowerCase().split(";")[0] ?? "").trim();
}

export async function confirmUpload(
  repo: UploadRepository,
  input: ConfirmInput,
  objectExists?: (objectKey: string) => Promise<boolean>,
): Promise<{ mediaId: string; status: UploadStatus; duplicate: boolean }> {
  const row = await repo.findByUploadId(input.uploadId);
  if (!row) throw new UploadError("NOT_FOUND", "Pending upload not found", 404);
  if (row.guestId !== input.guestId) {
    throw new UploadError("UNAUTHORIZED", "Upload does not belong to this guest", 403);
  }
  if (row.objectKey !== input.objectKey) {
    throw new UploadError("INVALID_OBJECT_KEY", "objectKey does not match the issued key", 403);
  }
  if (VISIBLE_MEDIA_STATUSES.includes(row.status as (typeof VISIBLE_MEDIA_STATUSES)[number])) {
    return { mediaId: row.uploadId, status: row.status, duplicate: true };
  }
  if (row.status === "deleted") {
    throw new UploadError("NOT_FOUND", "Upload was deleted", 404);
  }

  if (objectExists) {
    const ok = await objectExists(row.objectKey);
    if (!ok) throw new UploadError("NOT_UPLOADED", "Object is not present in storage yet", 409);
  }

  const confirmed = await repo.updateStatus(row.uploadId, "confirmed", {
    fileSize: input.fileSize || row.fileSize,
    mimeType: row.mimeType,
    width: input.width ?? row.width,
    height: input.height ?? row.height,
    duration: input.duration ?? row.duration,
    thumbnailObjectKey:
      input.thumbnailObjectKey && input.thumbnailObjectKey === row.thumbnailObjectKey
        ? row.thumbnailObjectKey
        : row.thumbnailObjectKey,
    confirmedAt: new Date().toISOString(),
  });

  return { mediaId: confirmed.uploadId, status: confirmed.status, duplicate: false };
}

export function staleCutoffIso(now = Date.now()) {
  return new Date(now - STALE_PENDING_MS).toISOString();
}

export async function cleanupStalePending(
  repo: UploadRepository,
  removeObjects: (keys: string[]) => Promise<void>,
) {
  const stale = await repo.listStalePending(staleCutoffIso());
  let cleaned = 0;
  for (const row of stale) {
    const keys = [row.objectKey, row.thumbnailObjectKey].filter(Boolean) as string[];
    try {
      if (keys.length) await removeObjects(keys);
    } catch {
      // Keep the row eligible for a later pass if object delete fails.
      continue;
    }
    await repo.markDeleted(row.uploadId);
    cleaned += 1;
  }
  return { eligible: stale.length, cleaned };
}
