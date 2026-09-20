import { prisma } from '../lib/prisma.js'
import { UploadError } from './upload-config.js'
import type { PendingUpload, UploadRepository } from './upload-core.js'

function asPending(row: {
  id: string
  clientUploadId: string
  eventId: string
  guestId: string
  uploadSessionId: string
  objectKey: string
  thumbnailObjectKey: string | null
  mediaType: string
  mimeType: string
  fileSize: number
  status: string
  storageProvider: string
  width: number | null
  height: number | null
  duration: number | null
  createdAt: Date
  confirmedAt: Date | null
}): PendingUpload {
  return {
    uploadId: row.id,
    clientUploadId: row.clientUploadId,
    eventId: row.eventId,
    guestId: row.guestId,
    uploadSessionId: row.uploadSessionId,
    objectKey: row.objectKey,
    thumbnailObjectKey: row.thumbnailObjectKey,
    mediaType: row.mediaType === 'video' ? 'video' : 'photo',
    mimeType: row.mimeType,
    fileSize: row.fileSize,
    status: row.status as PendingUpload['status'],
    storageProvider: row.storageProvider === 'r2' ? 'r2' : 'legacy',
    width: row.width,
    height: row.height,
    duration: row.duration,
    createdAt: row.createdAt.toISOString(),
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
  }
}

export function createPrismaUploadRepository(): UploadRepository {
  return {
    async getEvent(eventId) {
      const event = await prisma.event.findUnique({
        where: { id: eventId },
        select: { id: true, uploadsOpen: true },
      })
      return event ? { id: event.id, uploadsOpen: event.uploadsOpen } : null
    },
    async getSession(sessionId) {
      const session = await prisma.memoryUploadSession.findUnique({
        where: { id: sessionId },
        select: { id: true, eventId: true, guestId: true },
      })
      return session
    },
    async findByClientUploadId(clientUploadId, guestId) {
      const row = await prisma.memoryMedia.findFirst({
        where: { clientUploadId, guestId },
      })
      return row ? asPending(row) : null
    },
    async findByUploadId(uploadId) {
      const row = await prisma.memoryMedia.findUnique({ where: { id: uploadId } })
      return row ? asPending(row) : null
    },
    async insertPending(row) {
      try {
        const created = await prisma.memoryMedia.create({
          data: {
            id: row.uploadId,
            eventId: row.eventId,
            guestId: row.guestId,
            uploadSessionId: row.uploadSessionId,
            clientUploadId: row.clientUploadId,
            storageProvider: 'r2',
            objectKey: row.objectKey,
            thumbnailObjectKey: row.thumbnailObjectKey,
            originalFilename: 'upload',
            mimeType: row.mimeType,
            fileSize: row.fileSize,
            mediaType: row.mediaType,
            width: row.width,
            height: row.height,
            duration: row.duration,
            status: 'pending',
          },
        })
        return asPending(created)
      } catch (error) {
        const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
        if (code === 'P2002') throw new UploadError('CONFLICT', 'Unique constraint violated', 409)
        throw error
      }
    },
    async updateStatus(uploadId, status, patch) {
      const updated = await prisma.memoryMedia.update({
        where: { id: uploadId },
        data: {
          status,
          ...(patch?.fileSize != null ? { fileSize: patch.fileSize } : {}),
          ...(patch?.mimeType ? { mimeType: patch.mimeType } : {}),
          ...(patch?.width !== undefined ? { width: patch.width } : {}),
          ...(patch?.height !== undefined ? { height: patch.height } : {}),
          ...(patch?.duration !== undefined ? { duration: patch.duration } : {}),
          ...(patch?.thumbnailObjectKey !== undefined ? { thumbnailObjectKey: patch.thumbnailObjectKey } : {}),
          ...(patch?.confirmedAt ? { confirmedAt: new Date(patch.confirmedAt) } : {}),
        },
      })
      return asPending(updated)
    },
    async listStalePending(beforeIso) {
      const rows = await prisma.memoryMedia.findMany({
        where: { status: 'pending', storageProvider: 'r2', createdAt: { lt: new Date(beforeIso) } },
        take: 100,
      })
      return rows.map(asPending)
    },
    async markDeleted(uploadId) {
      await prisma.memoryMedia.update({ where: { id: uploadId }, data: { status: 'deleted' } })
    },
  }
}

