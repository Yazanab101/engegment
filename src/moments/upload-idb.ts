/**
 * Durable guest outbox: metadata + blobs (when the browser allows) + messages.
 * Large videos above BLOB_LIMIT_BYTES stay in memory for the current page only.
 */

const DB_NAME = 'engagement-memories-uploads'
const QUEUE_STORE = 'queue'
const BLOB_STORE = 'blobs'
const MESSAGE_STORE = 'messages'
const VERSION = 2
export const BLOB_LIMIT_BYTES = 32 * 1024 * 1024

export type PersistedUpload = {
  clientUploadId: string
  eventId: string
  uploadSessionId: string | null
  uploadId: string | null
  objectKey: string | null
  thumbnailObjectKey: string | null
  originalFilename: string
  mimeType: string
  fileSize: number
  mediaType: 'photo' | 'video'
  status: string
  uploadedToR2: boolean
  confirmed: boolean
  error: string | null
  attemptCount: number
  createdAt: number
  updatedAt: number
}

export type PersistedMessage = {
  clientMessageId: string
  eventId: string
  message: string
  status: 'queued' | 'sending' | 'sent' | 'retrying' | 'failed'
  attemptCount: number
  createdAt: number
  updatedAt: number
  error: string | null
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: 'clientUploadId' })
      }
      if (!db.objectStoreNames.contains(BLOB_STORE)) {
        db.createObjectStore(BLOB_STORE)
      }
      if (!db.objectStoreNames.contains(MESSAGE_STORE)) {
        db.createObjectStore(MESSAGE_STORE, { keyPath: 'clientMessageId' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function withStore<T>(
  store: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | void> {
  if (typeof indexedDB === 'undefined') return
  const db = await openDb()
  try {
    return await new Promise<T | void>((resolve, reject) => {
      const tx = db.transaction(store, mode)
      const result = run(tx.objectStore(store))
      if (result) {
        result.onsuccess = () => resolve(result.result)
        result.onerror = () => reject(result.error)
      } else {
        tx.oncomplete = () => resolve()
      }
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    return
  } finally {
    db.close()
  }
}

export async function saveUploadMeta(row: PersistedUpload) {
  await withStore(QUEUE_STORE, 'readwrite', (store) => store.put(row))
}

export async function loadUploadMeta(): Promise<PersistedUpload[]> {
  const rows = await withStore<PersistedUpload[]>(QUEUE_STORE, 'readonly', (store) => store.getAll())
  return rows ?? []
}

export async function removeUploadMeta(clientUploadId: string) {
  await withStore(QUEUE_STORE, 'readwrite', (store) => store.delete(clientUploadId))
  await removeUploadBlob(clientUploadId)
}

export async function saveUploadBlob(clientUploadId: string, blob: Blob) {
  if (blob.size > BLOB_LIMIT_BYTES) return
  await withStore(BLOB_STORE, 'readwrite', (store) => store.put(blob, clientUploadId))
}

export async function loadUploadBlob(clientUploadId: string): Promise<Blob | null> {
  const blob = await withStore<Blob>(BLOB_STORE, 'readonly', (store) => store.get(clientUploadId))
  return blob ?? null
}

export async function removeUploadBlob(clientUploadId: string) {
  await withStore(BLOB_STORE, 'readwrite', (store) => store.delete(clientUploadId))
}

export async function saveMessage(row: PersistedMessage) {
  await withStore(MESSAGE_STORE, 'readwrite', (store) => store.put(row))
}

export async function loadMessages(): Promise<PersistedMessage[]> {
  const rows = await withStore<PersistedMessage[]>(MESSAGE_STORE, 'readonly', (store) => store.getAll())
  return rows ?? []
}

export async function removeMessage(clientMessageId: string) {
  await withStore(MESSAGE_STORE, 'readwrite', (store) => store.delete(clientMessageId))
}
