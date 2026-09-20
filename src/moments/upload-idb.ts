/**
 * Persists upload-queue metadata only.
 *
 * Browser limitation: large video File/Blob objects cannot be stored reliably
 * in localStorage, and IndexedDB blob persistence is still lost if the user
 * force-kills the tab, iOS reclaims memory, or the browser discards the
 * original File handle after the picker is gone. We therefore store status,
 * IDs, and confirmation payload so a completed R2 PUT can be confirmed again
 * without re-uploading. Original file bytes are kept in memory for the
 * current page lifetime only.
 */

const DB_NAME = "engagement-memories-uploads";
const STORE = "queue";
const VERSION = 1;

export type PersistedUpload = {
  clientUploadId: string;
  eventId: string;
  uploadSessionId: string | null;
  uploadId: string | null;
  objectKey: string | null;
  thumbnailObjectKey: string | null;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  mediaType: "photo" | "video";
  status: string;
  uploadedToR2: boolean;
  confirmed: boolean;
  error: string | null;
  updatedAt: number;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "clientUploadId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveUploadMeta(row: PersistedUpload) {
  if (typeof indexedDB === "undefined") return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(row);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Persistence is best-effort on restricted browsers.
  }
}

export async function loadUploadMeta(): Promise<PersistedUpload[]> {
  if (typeof indexedDB === "undefined") return [];
  try {
    const db = await openDb();
    const rows = await new Promise<PersistedUpload[]>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve((req.result as PersistedUpload[]) ?? []);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return rows;
  } catch {
    return [];
  }
}

export async function removeUploadMeta(clientUploadId: string) {
  if (typeof indexedDB === "undefined") return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(clientUploadId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // ignore
  }
}
