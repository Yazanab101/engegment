import { prisma } from '../lib/prisma.js'
import { getCurrentEvent } from '../services/invitationService.js'
import { AppError } from '../lib/errors.js'
import {
  ADMIN_LIMIT_PER_MINUTE,
  DOWNLOAD_TTL_SECONDS,
  MESSAGE_LIMIT_PER_10_MIN,
  UPLOAD_AUTH_LIMIT_PER_MINUTE,
  VISIBLE_MEDIA_STATUSES,
  UploadError,
  type MediaKind,
} from './upload-config.js'
import { authorizeUpload, cleanupStalePending, confirmUpload } from './upload-core.js'
import { createPrismaUploadRepository } from './prismaRepo.js'
import { deleteR2Objects, getR2Object, headR2Object, putR2Object, signR2GetUrl, signR2PutUrl } from './r2.js'
import { adminLimitKey, consumeRateLimit, guestAuthLimitKey, messageLimitKey } from './rate-limit.js'
import { logUpload, logUploadError } from './log.js'

const tokenRe = /^[A-Za-z0-9_-]+$/
const repo = createPrismaUploadRepository()
const r2Signer = {
  signPut: (objectKey: string, mimeType: string, expiresIn: number) =>
    signR2PutUrl(objectKey, mimeType, expiresIn),
}

export function cleanText(input: string, max: number) {
  return input
    .replace(/[<>]/g, '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .trim()
    .slice(0, max)
}

export function assertDeviceToken(token: string) {
  if (!token || token.length < 20 || token.length > 120 || !tokenRe.test(token)) {
    throw new AppError(401, 'Guest session is not valid', 'GUEST_NOT_FOUND')
  }
  return token
}

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error
  if (error instanceof UploadError) {
    return new AppError(error.httpStatus, error.message, error.code)
  }
  return new AppError(500, 'Internal server error')
}

export async function getMemoryEventPublic() {
  const event = await getCurrentEvent()
  let gallery: { id: string; url: string; type: string }[] = []
  if (!event.uploadsOpen) {
    const rows = await prisma.memoryMedia.findMany({
      where: {
        eventId: event.id,
        isFavorite: true,
        isHidden: false,
        status: { in: [...VISIBLE_MEDIA_STATUSES] },
      },
      orderBy: { createdAt: 'desc' },
      take: 60,
    })
    const signed = await signStoredPaths(
      rows.map((row) => ({
        path: row.thumbnailObjectKey ?? row.objectKey,
        provider: row.storageProvider,
      })),
    )
    gallery = rows.map((row) => ({
      id: row.id,
      url: signed[row.thumbnailObjectKey ?? row.objectKey] ?? '',
      type: row.mediaType,
    }))
  }
  return {
    id: event.id,
    coupleNames: `${event.brideName} & ${event.groomName}`,
    eventDate: event.eventDate.toISOString().slice(0, 10),
    uploadsOpen: event.uploadsOpen,
    gallery,
  }
}

export async function requireMemoryGuest(deviceToken: string) {
  assertDeviceToken(deviceToken)
  const guest = await prisma.memoryGuest.findUnique({ where: { deviceToken } })
  if (!guest) throw new UploadError('GUEST_NOT_FOUND', 'Guest session is not valid', 401)
  await prisma.memoryGuest.update({
    where: { id: guest.id },
    data: { lastSeenAt: new Date() },
  })
  return guest
}

export async function identifyMemoryGuest(input: {
  deviceToken: string
  name: string
  table?: string | null
  phoneLast4?: string | null
}) {
  const event = await getCurrentEvent()
  const deviceToken = assertDeviceToken(input.deviceToken)
  const displayName = cleanText(input.name, 60)
  if (!displayName) throw new AppError(400, 'Name is required', 'INVALID_NAME')
  const tableLabel = input.table ? cleanText(input.table, 20) : null
  const digits = String(input.phoneLast4 || '').replace(/\D/g, '')
  const phoneLast4 = digits.length >= 4 ? digits.slice(-4) : digits.length ? digits : null

  const existing = await prisma.memoryGuest.findUnique({ where: { deviceToken } })
  if (existing) {
    const updated = await prisma.memoryGuest.update({
      where: { id: existing.id },
      data: {
        displayName,
        tableLabel: tableLabel ?? existing.tableLabel,
        phoneLast4: phoneLast4 ?? existing.phoneLast4,
        lastSeenAt: new Date(),
      },
    })
    return { id: updated.id, displayName: updated.displayName }
  }

  const created = await prisma.memoryGuest.create({
    data: {
      eventId: event.id,
      displayName,
      deviceToken,
      tableLabel,
      phoneLast4,
    },
  })
  return { id: created.id, displayName: created.displayName }
}

async function guestStats(guestId: string) {
  const [media, messages] = await Promise.all([
    prisma.memoryMedia.findMany({
      where: { guestId, status: { in: [...VISIBLE_MEDIA_STATUSES] } },
      select: { mediaType: true },
    }),
    prisma.memoryMessage.count({ where: { guestId } }),
  ])
  return {
    photos: media.filter((row) => row.mediaType === 'photo').length,
    videos: media.filter((row) => row.mediaType === 'video').length,
    messages,
  }
}

export async function getMemoryGuestState(deviceToken: string) {
  assertDeviceToken(deviceToken)
  const guest = await prisma.memoryGuest.findUnique({ where: { deviceToken } })
  if (!guest) return { guest: null, stats: null, media: [], messages: [] }

  await prisma.memoryGuest.update({
    where: { id: guest.id },
    data: { lastSeenAt: new Date() },
  })

  const [media, messages] = await Promise.all([
    prisma.memoryMedia.findMany({
      where: { guestId: guest.id, status: { in: [...VISIBLE_MEDIA_STATUSES] } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.memoryMessage.findMany({
      where: { guestId: guest.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, message: true, createdAt: true },
    }),
  ])
  const signed = await signStoredPaths(
    media.flatMap((row) => [
      { path: row.thumbnailObjectKey, provider: row.storageProvider },
      { path: row.objectKey, provider: row.storageProvider },
    ]),
  )
  return {
    guest: { id: guest.id, displayName: guest.displayName },
    stats: await guestStats(guest.id),
    media: media.map((row) => ({
      id: row.id,
      type: row.mediaType,
      caption: row.caption,
      createdAt: row.createdAt.toISOString(),
      thumbUrl: row.thumbnailObjectKey ? signed[row.thumbnailObjectKey] ?? null : row.mediaType === 'photo' ? signed[row.objectKey] ?? null : null,
      url: signed[row.objectKey] ?? null,
    })),
    messages: messages.map((row) => ({
      id: row.id,
      message: row.message,
      createdAt: row.createdAt.toISOString(),
    })),
  }
}

async function ensureUploadSession(input: {
  eventId: string
  guestId: string
  uploadSessionId?: string | null
  table?: string | null
}) {
  if (input.uploadSessionId) {
    const session = await prisma.memoryUploadSession.findUnique({
      where: { id: input.uploadSessionId },
    })
    if (!session || session.guestId !== input.guestId || session.eventId !== input.eventId) {
      throw new UploadError('SESSION_MISMATCH', 'Upload session does not belong to this guest', 403)
    }
    return session.id
  }
  const created = await prisma.memoryUploadSession.create({
    data: {
      eventId: input.eventId,
      guestId: input.guestId,
      tableLabel: input.table ?? null,
    },
  })
  return created.id
}

export async function authorizeGuestUpload(input: {
  deviceToken: string
  eventId: string
  uploadSessionId?: string | null
  clientUploadId: string
  originalFilename: string
  mimeType: string
  fileSize: number
  mediaType: MediaKind
  hasThumb?: boolean
  table?: string | null
}) {
  const guest = await requireMemoryGuest(input.deviceToken)
  const limited = consumeRateLimit(guestAuthLimitKey(guest.id), UPLOAD_AUTH_LIMIT_PER_MINUTE, 60_000)
  if (!limited.ok) throw new UploadError('RATE_LIMITED', 'Too many upload requests', 429)
  if (guest.eventId !== input.eventId) {
    throw new UploadError('UNAUTHORIZED', 'Guest does not belong to this event', 403)
  }

  const sessionId = await ensureUploadSession({
    eventId: input.eventId,
    guestId: guest.id,
    uploadSessionId: input.uploadSessionId,
    table: input.table,
  })

  try {
    const result = await authorizeUpload(repo, r2Signer, {
      eventId: input.eventId,
      guestId: guest.id,
      uploadSessionId: sessionId,
      clientUploadId: input.clientUploadId,
      originalFilename: input.originalFilename,
      mimeType: input.mimeType,
      fileSize: input.fileSize,
      mediaType: input.mediaType,
      hasThumb: Boolean(input.hasThumb),
    })
    logUpload('authorize_ok', {
      uploadId: result.uploadId,
      guestId: guest.id,
      eventId: input.eventId,
      alreadyConfirmed: result.alreadyConfirmed,
    })
    return { ...result, uploadSessionId: sessionId, guestId: guest.id }
  } catch (error) {
    logUploadError('authorize_failed', error, {
      guestId: guest.id,
      eventId: input.eventId,
      clientUploadId: input.clientUploadId,
    })
    throw error
  }
}

export async function confirmGuestUpload(input: {
  deviceToken: string
  uploadId: string
  objectKey: string
  fileSize: number
  mimeType: string
  width?: number | null
  height?: number | null
  duration?: number | null
  thumbnailObjectKey?: string | null
}) {
  const guest = await requireMemoryGuest(input.deviceToken)
  try {
    const result = await confirmUpload(
      repo,
      {
        uploadId: input.uploadId,
        guestId: guest.id,
        objectKey: input.objectKey,
        fileSize: input.fileSize,
        mimeType: input.mimeType,
        width: input.width,
        height: input.height,
        duration: input.duration,
        thumbnailObjectKey: input.thumbnailObjectKey,
      },
      async (objectKey) => {
        const meta = await headR2Object(objectKey)
        return Boolean(meta)
      },
    )
    logUpload('confirm_ok', {
      uploadId: input.uploadId,
      guestId: guest.id,
      duplicate: result.duplicate,
    })
    return result
  } catch (error) {
    logUploadError('confirm_failed', error, { uploadId: input.uploadId, guestId: guest.id })
    throw error
  }
}

export async function signStoredPath(path: string, provider: string | null | undefined) {
  if (!path) return null
  if (provider && provider !== 'r2') return null
  return signR2GetUrl(path, DOWNLOAD_TTL_SECONDS)
}

export async function signStoredPaths(
  items: { path: string | null | undefined; provider?: string | null | undefined }[],
) {
  const map: Record<string, string> = {}
  const unique = new Set<string>()
  for (const item of items) {
    if (item.path) unique.add(item.path)
  }
  await Promise.all(
    [...unique].map(async (path) => {
      const url = await signStoredPath(path, 'r2')
      if (url) map[path] = url
    }),
  )
  return map
}

export async function removeStoredPaths(keys: (string | null | undefined)[]) {
  await deleteR2Objects(keys.filter((key): key is string => Boolean(key)))
}

export async function guestMediaAccessUrl(deviceToken: string, mediaId: string) {
  const guest = await requireMemoryGuest(deviceToken)
  const row = await prisma.memoryMedia.findUnique({ where: { id: mediaId } })
  if (!row || row.guestId !== guest.id) throw new UploadError('NOT_FOUND', 'Media not found', 404)
  if (!VISIBLE_MEDIA_STATUSES.includes(row.status as (typeof VISIBLE_MEDIA_STATUSES)[number])) {
    throw new UploadError('NOT_FOUND', 'Media is not available', 404)
  }
  const url = await signStoredPath(row.objectKey, row.storageProvider)
  if (!url) throw new UploadError('NOT_FOUND', 'Could not sign media', 404)
  return { url, expiresIn: DOWNLOAD_TTL_SECONDS }
}

export async function adminMediaAccessUrl(mediaId: string) {
  const row = await prisma.memoryMedia.findUnique({ where: { id: mediaId } })
  if (!row) throw new UploadError('NOT_FOUND', 'Media not found', 404)
  const url = await signStoredPath(row.objectKey, row.storageProvider)
  if (!url) throw new UploadError('NOT_FOUND', 'Could not sign media', 404)
  return { url, expiresIn: DOWNLOAD_TTL_SECONDS }
}

export async function guestMediaObject(deviceToken: string, mediaId: string, range?: string) {
  const guest = await requireMemoryGuest(deviceToken)
  const row = await prisma.memoryMedia.findUnique({ where: { id: mediaId } })
  if (!row || row.guestId !== guest.id) throw new UploadError('NOT_FOUND', 'Media not found', 404)
  if (!VISIBLE_MEDIA_STATUSES.includes(row.status as (typeof VISIBLE_MEDIA_STATUSES)[number])) {
    throw new UploadError('NOT_FOUND', 'Media is not available', 404)
  }
  return { object: await getR2Object(row.objectKey, range), mimeType: row.mimeType }
}

export async function adminMediaObject(mediaId: string, range?: string) {
  const row = await prisma.memoryMedia.findUnique({ where: { id: mediaId } })
  if (!row) throw new UploadError('NOT_FOUND', 'Media not found', 404)
  return { object: await getR2Object(row.objectKey, range), mimeType: row.mimeType }
}

export async function saveGuestVideoThumbnail(deviceToken: string, mediaId: string, image: string) {
  const guest = await requireMemoryGuest(deviceToken)
  const row = await prisma.memoryMedia.findUnique({ where: { id: mediaId } })
  if (!row || row.guestId !== guest.id) throw new UploadError('NOT_FOUND', 'Media not found', 404)
  if (row.mediaType !== 'video') throw new UploadError('INVALID', 'Only videos can save a frame', 400)
  if (row.thumbnailObjectKey) return { ok: true, thumbnailObjectKey: row.thumbnailObjectKey }

  const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(image)
  if (!match) throw new UploadError('INVALID', 'Expected a JPEG frame', 400)
  const body = Buffer.from(match[1], 'base64')
  if (body.length < 32 || body.length > 1_500_000) {
    throw new UploadError('INVALID', 'JPEG frame is not valid', 400)
  }

  const key = `${row.objectKey.replace(/\.[^.]+$/, '')}-thumb.jpg`
  await putR2Object(key, body, 'image/jpeg')
  await prisma.memoryMedia.update({
    where: { id: row.id },
    data: { thumbnailObjectKey: key },
  })
  return { ok: true, thumbnailObjectKey: key }
}

export async function finalizeGuestCaptions(input: {
  deviceToken: string
  mediaIds: string[]
  caption?: string | null
}) {
  const guest = await requireMemoryGuest(input.deviceToken)
  const caption = input.caption ? cleanText(input.caption, 600) : null
  if (input.mediaIds.length) {
    await prisma.memoryMedia.updateMany({
      where: {
        guestId: guest.id,
        id: { in: input.mediaIds },
        status: { in: [...VISIBLE_MEDIA_STATUSES] },
      },
      data: { caption },
    })
  }
  return { ok: true }
}

export async function updateGuestCaption(input: {
  deviceToken: string
  mediaId: string
  caption: string
}) {
  const guest = await requireMemoryGuest(input.deviceToken)
  const updated = await prisma.memoryMedia.updateMany({
    where: { id: input.mediaId, guestId: guest.id },
    data: { caption: cleanText(input.caption, 600) },
  })
  if (!updated.count) throw new AppError(404, 'Media not found', 'NOT_FOUND')
  return { ok: true }
}

export async function deleteGuestMedia(deviceToken: string, mediaId: string) {
  const guest = await requireMemoryGuest(deviceToken)
  const row = await prisma.memoryMedia.findFirst({
    where: { id: mediaId, guestId: guest.id },
  })
  if (!row) throw new AppError(404, 'Media not found', 'NOT_FOUND')
  await removeStoredPaths([row.objectKey, row.thumbnailObjectKey])
  await prisma.memoryMedia.update({
    where: { id: row.id },
    data: { status: 'deleted' },
  })
  logUpload('guest_delete_ok', { uploadId: row.id, guestId: guest.id })
  return { ok: true }
}

export async function sendMemoryMessage(deviceToken: string, raw: string) {
  const event = await getCurrentEvent()
  const guest = await requireMemoryGuest(deviceToken)
  const message = cleanText(raw, 1000)
  if (!message) throw new AppError(400, 'Message is required', 'EMPTY_MESSAGE')
  const limited = consumeRateLimit(messageLimitKey(guest.id), MESSAGE_LIMIT_PER_10_MIN, 10 * 60_000)
  if (!limited.ok) throw new UploadError('RATE_LIMITED', 'Too many messages', 429)
  const since = new Date(Date.now() - 10 * 60 * 1000)
  const recent = await prisma.memoryMessage.count({
    where: { guestId: guest.id, createdAt: { gte: since } },
  })
  if (recent >= 15) throw new UploadError('RATE_LIMITED', 'Too many messages', 429)
  await prisma.memoryMessage.create({
    data: { eventId: event.id, guestId: guest.id, message },
  })
  return { ok: true }
}

export function assertAdminRateLimit(userId: string) {
  const limited = consumeRateLimit(adminLimitKey(userId), ADMIN_LIMIT_PER_MINUTE, 60_000)
  if (!limited.ok) throw new UploadError('RATE_LIMITED', 'Too many admin requests', 429)
}

export async function runPendingCleanup() {
  try {
    const result = await cleanupStalePending(repo, deleteR2Objects)
    if (result.eligible) logUpload('cleanup_pending', result)
    return result
  } catch (error) {
    logUploadError('cleanup_failed', error)
    return { eligible: 0, cleaned: 0 }
  }
}

export async function adminOverview() {
  const event = await getCurrentEvent()
  void runPendingCleanup()
  const visible = { eventId: event.id, status: { in: [...VISIBLE_MEDIA_STATUSES] } }
  const [guests, photos, videos, messages, storage] = await Promise.all([
    prisma.memoryGuest.count({ where: { eventId: event.id } }),
    prisma.memoryMedia.count({ where: { ...visible, mediaType: 'photo' } }),
    prisma.memoryMedia.count({ where: { ...visible, mediaType: 'video' } }),
    prisma.memoryMessage.count({ where: { eventId: event.id } }),
    prisma.memoryMedia.aggregate({
      where: visible,
      _sum: { fileSize: true },
    }),
  ])
  const [recentMedia, recentMessages] = await Promise.all([
    prisma.memoryMedia.findMany({
      where: visible,
      orderBy: { createdAt: 'desc' },
      take: 6,
      include: { guest: { select: { displayName: true } } },
    }),
    prisma.memoryMessage.findMany({
      where: { eventId: event.id },
      orderBy: { createdAt: 'desc' },
      take: 6,
      include: { guest: { select: { displayName: true } } },
    }),
  ])
  return {
    event: {
      id: event.id,
      coupleNames: `${event.brideName} & ${event.groomName}`,
      eventDate: event.eventDate.toISOString(),
      uploadsOpen: event.uploadsOpen,
    },
    guests,
    photos,
    videos,
    messages,
    storageBytes: storage._sum.fileSize ?? 0,
    recentActivity: [
      ...recentMedia.map((row) => ({
        id: row.id,
        kind: row.mediaType,
        guestName: row.guest.displayName,
        createdAt: row.createdAt.toISOString(),
      })),
      ...recentMessages.map((row) => ({
        id: row.id,
        kind: 'message',
        guestName: row.guest.displayName,
        createdAt: row.createdAt.toISOString(),
      })),
    ]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8),
  }
}

export async function adminListGuests(input: {
  search?: string
  sort?: 'activity' | 'name' | 'photos' | 'videos' | 'uploads'
}) {
  const event = await getCurrentEvent()
  const guests = await prisma.memoryGuest.findMany({
    where: {
      eventId: event.id,
      ...(input.search
        ? {
            OR: [
              { displayName: { contains: input.search, mode: 'insensitive' as const } },
              ...(input.search.replace(/\D/g, '').slice(-4).length >= 4
                ? [{ phoneLast4: { contains: input.search.replace(/\D/g, '').slice(-4) } }]
                : []),
            ],
          }
        : {}),
    },
    select: {
      id: true,
      displayName: true,
      tableLabel: true,
      phoneLast4: true,
      createdAt: true,
      lastSeenAt: true,
    },
    take: 500,
  })
  const guestIds = guests.map((guest) => guest.id)
  if (!guestIds.length) return []

  const visible = {
    eventId: event.id,
    guestId: { in: guestIds },
    status: { in: [...VISIBLE_MEDIA_STATUSES] },
  }
  const [mediaGroups, sessionGroups, messageGroups, latestRows] = await Promise.all([
    prisma.memoryMedia.groupBy({
      by: ['guestId', 'mediaType'],
      where: visible,
      _count: { _all: true },
      _min: { createdAt: true },
      _max: { createdAt: true },
    }),
    prisma.memoryMedia.groupBy({
      by: ['guestId', 'uploadSessionId'],
      where: visible,
    }),
    prisma.memoryMessage.groupBy({
      by: ['guestId'],
      where: { eventId: event.id, guestId: { in: guestIds } },
      _count: { _all: true },
    }),
    prisma.memoryMedia.findMany({
      where: visible,
      orderBy: { createdAt: 'desc' },
      distinct: ['guestId'],
      select: {
        id: true,
        guestId: true,
        mediaType: true,
        objectKey: true,
        thumbnailObjectKey: true,
        storageProvider: true,
      },
    }),
  ])

  const photos = new Map<string, number>()
  const videos = new Map<string, number>()
  const firstUpload = new Map<string, Date>()
  const lastUpload = new Map<string, Date>()
  for (const row of mediaGroups) {
    const count = row._count._all
    if (row.mediaType === 'video') videos.set(row.guestId, count)
    else photos.set(row.guestId, (photos.get(row.guestId) ?? 0) + count)
    if (row._min.createdAt) {
      const current = firstUpload.get(row.guestId)
      if (!current || row._min.createdAt < current) firstUpload.set(row.guestId, row._min.createdAt)
    }
    if (row._max.createdAt) {
      const current = lastUpload.get(row.guestId)
      if (!current || row._max.createdAt > current) lastUpload.set(row.guestId, row._max.createdAt)
    }
  }

  const sessions = new Map<string, number>()
  for (const row of sessionGroups) {
    sessions.set(row.guestId, (sessions.get(row.guestId) ?? 0) + 1)
  }
  const messages = new Map(messageGroups.map((row) => [row.guestId, row._count._all]))
  const signed = await signStoredPaths(
    latestRows.flatMap((row) => [
      { path: row.thumbnailObjectKey, provider: row.storageProvider },
      { path: row.objectKey, provider: row.storageProvider },
    ]),
  )
  const latestThumb = new Map(
    latestRows.map((row) => [
      row.guestId,
      {
        type: row.mediaType,
        mediaId: row.id,
        thumbUrl:
          signed[row.thumbnailObjectKey ?? (row.mediaType === 'photo' ? row.objectKey : '')] ?? null,
        url: signed[row.objectKey] ?? null,
      },
    ]),
  )

  const rows = guests.map((guest) => ({
    id: guest.id,
    name: guest.displayName,
    table: guest.tableLabel,
    phoneLast4: guest.phoneLast4,
    photos: photos.get(guest.id) ?? 0,
    videos: videos.get(guest.id) ?? 0,
    messages: messages.get(guest.id) ?? 0,
    sessions: sessions.get(guest.id) ?? 0,
    firstUpload: firstUpload.get(guest.id)?.toISOString() ?? null,
    lastUpload: lastUpload.get(guest.id)?.toISOString() ?? null,
    createdAt: guest.createdAt.toISOString(),
    lastSeenAt: guest.lastSeenAt.toISOString(),
    latestThumb: latestThumb.get(guest.id) ?? null,
  }))

  rows.sort((a, b) => {
    if (input.sort === 'name') return a.name.localeCompare(b.name, 'ar')
    if (input.sort === 'photos') return b.photos - a.photos
    if (input.sort === 'videos') return b.videos - a.videos
    if (input.sort === 'uploads') return b.photos + b.videos - (a.photos + a.videos)
    const aTime = a.lastUpload ?? a.lastSeenAt
    const bTime = b.lastUpload ?? b.lastSeenAt
    return new Date(bTime).getTime() - new Date(aTime).getTime()
  })
  return rows
}

export async function adminGetGuest(guestId: string) {
  const event = await getCurrentEvent()
  const guest = await prisma.memoryGuest.findFirst({
    where: { id: guestId, eventId: event.id },
    select: { id: true, displayName: true, tableLabel: true, createdAt: true, lastSeenAt: true },
  })
  if (!guest) throw new AppError(404, 'Memory guest not found', 'NOT_FOUND')
  const visible = {
    eventId: event.id,
    guestId: guest.id,
    status: { in: [...VISIBLE_MEDIA_STATUSES] },
  }
  const [photoCount, videoCount, messageCount, sessionGroups, first, last] = await Promise.all([
    prisma.memoryMedia.count({ where: { ...visible, mediaType: 'photo' } }),
    prisma.memoryMedia.count({ where: { ...visible, mediaType: 'video' } }),
    prisma.memoryMessage.count({ where: { eventId: event.id, guestId: guest.id } }),
    prisma.memoryMedia.groupBy({ by: ['uploadSessionId'], where: visible }),
    prisma.memoryMedia.findFirst({ where: visible, orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
    prisma.memoryMedia.findFirst({ where: visible, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
  ])
  return {
    id: guest.id,
    name: guest.displayName,
    table: guest.tableLabel,
    photos: photoCount,
    videos: videoCount,
    messages: messageCount,
    sessions: sessionGroups.length,
    firstUpload: first?.createdAt.toISOString() ?? null,
    lastUpload: last?.createdAt.toISOString() ?? null,
    lastSeenAt: guest.lastSeenAt.toISOString(),
    createdAt: guest.createdAt.toISOString(),
  }
}

export async function adminListMedia(input: {
  filter?: 'all' | 'photos' | 'videos' | 'favorites' | 'hidden'
  guestId?: string | null
  page?: number
  limit?: number
}) {
  const event = await getCurrentEvent()
  const page = input.page ?? 1
  const limit = input.limit ?? 40
  const where = {
    eventId: event.id,
    status: { in: [...VISIBLE_MEDIA_STATUSES] },
    ...(input.filter === 'photos' ? { mediaType: 'photo' } : {}),
    ...(input.filter === 'videos' ? { mediaType: 'video' } : {}),
    ...(input.filter === 'favorites' ? { isFavorite: true } : {}),
    ...(input.filter === 'hidden' ? { isHidden: true } : { isHidden: false }),
    ...(input.guestId ? { guestId: input.guestId } : {}),
  }
  const [total, rows] = await Promise.all([
    prisma.memoryMedia.count({ where }),
    prisma.memoryMedia.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { guest: { select: { displayName: true } } },
    }),
  ])
  const signed = await signStoredPaths(
    rows.flatMap((row) => [
      { path: row.thumbnailObjectKey, provider: row.storageProvider },
      { path: row.objectKey, provider: row.storageProvider },
    ]),
  )
  return {
    items: rows.map((row) => ({
      id: row.id,
      type: row.mediaType,
      guestName: row.guest.displayName,
      guestId: row.guestId,
      caption: row.caption,
      createdAt: row.createdAt.toISOString(),
      isFavorite: row.isFavorite,
      isHidden: row.isHidden,
      fileSize: row.fileSize,
      thumbUrl: row.thumbnailObjectKey
        ? signed[row.thumbnailObjectKey] ?? null
        : row.mediaType === 'photo'
          ? signed[row.objectKey] ?? null
          : null,
      url: signed[row.objectKey] ?? null,
    })),
    page,
    pageSize: limit,
    total,
    hasMore: page * limit < total,
  }
}

export async function adminUpdateMedia(ids: string[], action: 'favorite' | 'unfavorite' | 'hide' | 'unhide' | 'delete') {
  if (action === 'delete') {
    const rows = await prisma.memoryMedia.findMany({ where: { id: { in: ids } } })
    await removeStoredPaths(rows.flatMap((row) => [row.objectKey, row.thumbnailObjectKey]))
    await prisma.memoryMedia.updateMany({
      where: { id: { in: ids } },
      data: { status: 'deleted' },
    })
    logUpload('admin_delete_ok', { count: rows.length })
    return { ok: true }
  }
  const data =
    action === 'favorite'
      ? { isFavorite: true }
      : action === 'unfavorite'
        ? { isFavorite: false }
        : action === 'hide'
          ? { isHidden: true }
          : { isHidden: false }
  await prisma.memoryMedia.updateMany({ where: { id: { in: ids } }, data })
  return { ok: true }
}

export async function adminGuestDownloadUrls(guestId: string) {
  const event = await getCurrentEvent()
  const rows = await prisma.memoryMedia.findMany({
    where: {
      eventId: event.id,
      guestId,
      status: { in: [...VISIBLE_MEDIA_STATUSES] },
    },
    select: { id: true, objectKey: true, storageProvider: true, mediaType: true, originalFilename: true },
    orderBy: { createdAt: 'asc' },
  })
  const signed = await signStoredPaths(rows.map((row) => ({ path: row.objectKey, provider: row.storageProvider })))
  return rows
    .map((row) => ({
      id: row.id,
      type: row.mediaType,
      filename: row.originalFilename || (row.mediaType === 'video' ? 'memory.mp4' : 'memory.jpg'),
      url: signed[row.objectKey] ?? null,
    }))
    .filter((row) => row.url)
}

export async function adminListMessages(archived = false, guestId?: string) {
  const event = await getCurrentEvent()
  const rows = await prisma.memoryMessage.findMany({
    where: { eventId: event.id, isArchived: archived, ...(guestId ? { guestId } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 500,
    include: { guest: { select: { displayName: true } } },
  })
  return rows.map((row) => ({
    id: row.id,
    guestName: row.guest.displayName,
    message: row.message,
    createdAt: row.createdAt.toISOString(),
    isFavorite: row.isFavorite,
    isArchived: row.isArchived,
  }))
}

export async function adminUpdateMessage(
  id: string,
  action: 'favorite' | 'unfavorite' | 'archive' | 'unarchive' | 'delete',
) {
  if (action === 'delete') {
    await prisma.memoryMessage.delete({ where: { id } })
    return { ok: true }
  }
  const data =
    action === 'favorite'
      ? { isFavorite: true }
      : action === 'unfavorite'
        ? { isFavorite: false }
        : action === 'archive'
          ? { isArchived: true }
          : { isArchived: false }
  await prisma.memoryMessage.update({ where: { id }, data })
  return { ok: true }
}

export async function setUploadsOpen(open: boolean) {
  const event = await prisma.event.update({
    where: { slug: 'current' },
    data: { uploadsOpen: open },
  })
  return { uploadsOpen: event.uploadsOpen }
}
