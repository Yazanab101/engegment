import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { getCurrentEvent } from '../services/invitationService.js'
import {
  ADMIN_LIMIT_PER_MINUTE,
  DOWNLOAD_TTL_SECONDS,
  PRESIGN_TTL_SECONDS,
  UploadError,
  type MediaKind,
} from './upload-config.js'
import {
  STORY_SIGNED_GET_LIMIT_PER_MINUTE,
  STORY_VIEW_LIMIT_PER_MINUTE,
  type StoryExpireMode,
} from './story-config.js'
import {
  assertStoryObjectKey,
  buildStoryObjectKeys,
  classifyStoryUpload,
  clampPhotoDuration,
  isStoryVisibleToGuests,
  playbackDurationSeconds,
  resolveExpiresAt,
  ringState,
  uniqueViewerKey,
} from './story-core.js'
import { deleteR2Objects, headR2Object, signR2GetUrl, signR2PutUrl } from './r2.js'
import { adminLimitKey, consumeRateLimit, storyAccessLimitKey, storyViewLimitKey } from './rate-limit.js'

const tokenPattern = /^[A-Za-z0-9_-]+$/

function asPublicDuration(row: {
  mediaType: string
  duration: number | null
}) {
  return playbackDurationSeconds({
    mediaType: row.mediaType === 'video' ? 'video' : 'photo',
    configuredDuration: row.duration,
    mediaDuration: row.mediaType === 'video' ? row.duration : null,
  })
}

async function nextSortOrder(eventId: string) {
  const last = await prisma.eventStory.findFirst({
    where: { eventId, status: { not: 'deleted' } },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  })
  return (last?.sortOrder ?? -1) + 1
}

async function lookupGuest(deviceToken: string) {
  if (!deviceToken || deviceToken.length < 20 || !tokenPattern.test(deviceToken)) return null
  return prisma.memoryGuest.findUnique({
    where: { deviceToken },
    select: { id: true, eventId: true },
  })
}

function eventDate(event: { eventDate: Date }) {
  return event.eventDate.toISOString().slice(0, 10)
}

export function assertAdminStoryRateLimit(userId: string) {
  const limited = consumeRateLimit(adminLimitKey(userId), ADMIN_LIMIT_PER_MINUTE, 60_000)
  if (!limited.ok) throw new UploadError('RATE_LIMITED', 'Too many admin requests', 429)
}

export async function authorizeStoryUpload(input: {
  userId: string
  mimeType: string
  fileSize: number
  mediaType: MediaKind
  hasThumb: boolean
  duration?: number | null
  expireMode: StoryExpireMode
  customExpiresAt?: string | null
  startsAt?: string | null
  isActive?: boolean
}) {
  assertAdminStoryRateLimit(input.userId)
  const classified = classifyStoryUpload(input.mimeType, input.fileSize, input.mediaType)
  const event = await getCurrentEvent()
  const storyId = crypto.randomUUID()
  const keys = buildStoryObjectKeys({
    eventId: event.id,
    storyId,
    ext: classified.ext,
    hasThumb: input.hasThumb,
  })
  const duration =
    input.mediaType === 'photo'
      ? clampPhotoDuration(input.duration)
      : input.duration && input.duration > 0
        ? input.duration
        : null
  const expiresAt = resolveExpiresAt({
    mode: input.expireMode,
    eventDate: eventDate(event),
    custom: input.customExpiresAt,
  })
  await prisma.eventStory.create({
    data: {
      id: storyId,
      eventId: event.id,
      mediaType: input.mediaType,
      objectKey: keys.objectKey,
      thumbnailObjectKey: keys.thumbnailObjectKey,
      mimeType: input.mimeType,
      fileSize: input.fileSize,
      duration,
      sortOrder: await nextSortOrder(event.id),
      isActive: false,
      status: 'pending',
      startsAt: input.startsAt ? new Date(input.startsAt) : null,
      expiresAt,
      createdBy: input.userId,
    },
  })
  const [signedUploadUrl, signedThumbUrl] = await Promise.all([
    signR2PutUrl(keys.objectKey, input.mimeType, PRESIGN_TTL_SECONDS),
    keys.thumbnailObjectKey ? signR2PutUrl(keys.thumbnailObjectKey, 'image/jpeg', PRESIGN_TTL_SECONDS) : Promise.resolve(null),
  ])
  return {
    storyId,
    objectKey: keys.objectKey,
    thumbnailObjectKey: keys.thumbnailObjectKey,
    signedUploadUrl,
    signedThumbUrl,
    expiresAt: new Date(Date.now() + PRESIGN_TTL_SECONDS * 1000).toISOString(),
    intendedActive: input.isActive !== false,
  }
}

export async function confirmStoryUpload(input: {
  userId: string
  storyId: string
  objectKey: string
  thumbnailObjectKey?: string | null
  fileSize: number
  mimeType: string
  duration?: number | null
  activate?: boolean
}) {
  assertAdminStoryRateLimit(input.userId)
  const row = await prisma.eventStory.findUnique({ where: { id: input.storyId } })
  if (!row || row.status === 'deleted') throw new UploadError('NOT_FOUND', 'Story not found', 404)
  assertStoryObjectKey(input.objectKey, row.eventId, row.id)
  if (row.objectKey !== input.objectKey) {
    throw new UploadError('INVALID_OBJECT_KEY', 'objectKey does not match the issued key', 403)
  }
  const meta = await headR2Object(row.objectKey)
  if (!meta) throw new UploadError('OBJECT_MISSING', 'Story file was not found in storage', 409)
  const duration =
    row.mediaType === 'photo'
      ? clampPhotoDuration(input.duration ?? row.duration)
      : input.duration && input.duration > 0
        ? input.duration
        : row.duration
  await prisma.eventStory.update({
    where: { id: row.id },
    data: {
      status: 'ready',
      isActive: input.activate !== false,
      fileSize: meta.contentLength || input.fileSize,
      mimeType: meta.contentType || input.mimeType,
      thumbnailObjectKey: input.thumbnailObjectKey ?? row.thumbnailObjectKey,
      duration,
    },
  })
  return { ok: true, storyId: row.id }
}

export async function listAdminStories() {
  const event = await getCurrentEvent()
  const stories = await prisma.eventStory.findMany({
    where: { eventId: event.id, status: { not: 'deleted' } },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  })
  const ids = stories.map((s) => s.id)
  const views = ids.length
    ? await prisma.storyView.findMany({
        where: { storyId: { in: ids } },
        select: { storyId: true, guestId: true, deviceId: true },
      })
    : []
  const viewMap = new Map<string, { views: number; uniqueViewers: number }>()
  for (const story of stories) {
    const mine = views.filter((v) => v.storyId === story.id)
    const unique = new Set(
      mine.map((v) => uniqueViewerKey(v.guestId, v.deviceId)).filter((key): key is string => Boolean(key)),
    )
    viewMap.set(story.id, { views: mine.length, uniqueViewers: unique.size })
  }
  const thumbs = await Promise.all(
    stories.map(async (story) => {
      const key = story.thumbnailObjectKey || (story.mediaType === 'photo' ? story.objectKey : null)
      return key ? signR2GetUrl(key, DOWNLOAD_TTL_SECONDS) : null
    }),
  )
  return stories.map((story, index) => ({
    id: story.id,
    mediaType: story.mediaType as 'photo' | 'video',
    duration: asPublicDuration(story),
    configuredDuration: story.duration,
    sortOrder: story.sortOrder,
    isActive: story.isActive,
    status: story.status,
    startsAt: story.startsAt?.toISOString() ?? null,
    expiresAt: story.expiresAt?.toISOString() ?? null,
    createdAt: story.createdAt.toISOString(),
    fileSize: story.fileSize,
    thumbUrl: thumbs[index] ?? null,
    views: viewMap.get(story.id)?.views ?? 0,
    uniqueViewers: viewMap.get(story.id)?.uniqueViewers ?? 0,
  }))
}

export async function updateStory(input: {
  storyId: string
  isActive?: boolean
  duration?: number | null
  startsAt?: string | null
  expiresAt?: string | null
  expireMode?: StoryExpireMode
  customExpiresAt?: string | null
}) {
  const event = await getCurrentEvent()
  const row = await prisma.eventStory.findFirst({
    where: { id: input.storyId, eventId: event.id },
  })
  if (!row || row.status === 'deleted') throw new UploadError('NOT_FOUND', 'Story not found', 404)
  const data: Prisma.EventStoryUpdateInput = {}
  if (input.isActive !== undefined) data.isActive = input.isActive
  if (input.duration !== undefined) {
    data.duration = row.mediaType === 'photo' ? clampPhotoDuration(input.duration) : input.duration
  }
  if (input.startsAt !== undefined) data.startsAt = input.startsAt ? new Date(input.startsAt) : null
  if (input.expireMode) {
    data.expiresAt = resolveExpiresAt({
      mode: input.expireMode,
      eventDate: eventDate(event),
      custom: input.customExpiresAt ?? input.expiresAt,
    })
  } else if (input.expiresAt !== undefined) {
    data.expiresAt = input.expiresAt ? new Date(input.expiresAt) : null
  }
  await prisma.eventStory.update({ where: { id: row.id }, data })
  return { ok: true }
}

export async function reorderStories(storyIds: string[]) {
  const event = await getCurrentEvent()
  await prisma.$transaction(
    storyIds.map((id, index) =>
      prisma.eventStory.updateMany({
        where: { id, eventId: event.id },
        data: { sortOrder: index },
      }),
    ),
  )
  return { ok: true }
}

export async function deleteStory(storyId: string) {
  const event = await getCurrentEvent()
  const row = await prisma.eventStory.findFirst({
    where: { id: storyId, eventId: event.id },
  })
  if (!row) throw new UploadError('NOT_FOUND', 'Story not found', 404)
  await deleteR2Objects([row.objectKey, row.thumbnailObjectKey].filter(Boolean) as string[])
  await prisma.eventStory.update({
    where: { id: row.id },
    data: { status: 'deleted', isActive: false },
  })
  return { ok: true }
}

export async function adminStoryAccessUrl(storyId: string) {
  const row = await prisma.eventStory.findUnique({ where: { id: storyId } })
  if (!row || row.status === 'deleted') throw new UploadError('NOT_FOUND', 'Story not found', 404)
  const [url, thumbUrl] = await Promise.all([
    signR2GetUrl(row.objectKey, DOWNLOAD_TTL_SECONDS),
    row.thumbnailObjectKey ? signR2GetUrl(row.thumbnailObjectKey, DOWNLOAD_TTL_SECONDS) : Promise.resolve(null),
  ])
  return {
    url,
    thumbUrl,
    mediaType: row.mediaType as 'photo' | 'video',
    expiresIn: DOWNLOAD_TTL_SECONDS,
  }
}

export async function listGuestStories(deviceToken: string) {
  const event = await getCurrentEvent()
  const rows = await prisma.eventStory.findMany({
    where: { eventId: event.id, status: 'ready', isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  })
  const visible = rows.filter((row) =>
    isStoryVisibleToGuests({
      isActive: row.isActive,
      status: row.status,
      startsAt: row.startsAt,
      expiresAt: row.expiresAt,
    }),
  )
  const guest = await lookupGuest(deviceToken)
  let viewedIds: string[] = []
  if (visible.length) {
    const views = await prisma.storyView.findMany({
      where: {
        storyId: { in: visible.map((s) => s.id) },
        OR: guest?.id
          ? [{ deviceId: deviceToken }, { guestId: guest.id }]
          : [{ deviceId: deviceToken }],
      },
      select: { storyId: true },
    })
    viewedIds = [...new Set(views.map((v) => v.storyId))]
  }
  const ids = visible.map((s) => s.id)
  return {
    eventId: event.id,
    coupleNames: `${event.brideName} & ${event.groomName}`,
    eventDate: eventDate(event),
    ring: ringState(ids, viewedIds),
    viewedIds,
    stories: visible.map((story) => ({
      id: story.id,
      mediaType: story.mediaType as 'photo' | 'video',
      duration: asPublicDuration(story),
      createdAt: story.createdAt.toISOString(),
      viewed: viewedIds.includes(story.id),
    })),
  }
}

export async function guestStoryAccessUrl(deviceToken: string, storyId: string) {
  if (!deviceToken || deviceToken.length < 20 || !tokenPattern.test(deviceToken)) {
    throw new UploadError('UNAUTHORIZED', 'Device session is required', 401)
  }
  const limited = consumeRateLimit(storyAccessLimitKey(deviceToken), STORY_SIGNED_GET_LIMIT_PER_MINUTE, 60_000)
  if (!limited.ok) throw new UploadError('RATE_LIMITED', 'Too many story requests', 429)
  const event = await getCurrentEvent()
  const row = await prisma.eventStory.findFirst({
    where: { id: storyId, eventId: event.id },
  })
  if (
    !row ||
    !isStoryVisibleToGuests({
      isActive: row.isActive,
      status: row.status,
      startsAt: row.startsAt,
      expiresAt: row.expiresAt,
    })
  ) {
    throw new UploadError('NOT_FOUND', 'Story is not available', 404)
  }
  const [url, thumbUrl] = await Promise.all([
    signR2GetUrl(row.objectKey, DOWNLOAD_TTL_SECONDS),
    row.thumbnailObjectKey ? signR2GetUrl(row.thumbnailObjectKey, DOWNLOAD_TTL_SECONDS) : Promise.resolve(null),
  ])
  return {
    url,
    thumbUrl,
    mediaType: row.mediaType as 'photo' | 'video',
    expiresIn: DOWNLOAD_TTL_SECONDS,
  }
}

export async function markStoryViewed(deviceToken: string, storyId: string) {
  if (!deviceToken || deviceToken.length < 20 || !tokenPattern.test(deviceToken)) {
    throw new UploadError('UNAUTHORIZED', 'Device session is required', 401)
  }
  const limited = consumeRateLimit(storyViewLimitKey(deviceToken), STORY_VIEW_LIMIT_PER_MINUTE, 60_000)
  if (!limited.ok) throw new UploadError('RATE_LIMITED', 'Too many story views', 429)
  const event = await getCurrentEvent()
  const row = await prisma.eventStory.findFirst({
    where: { id: storyId, eventId: event.id },
  })
  if (
    !row ||
    !isStoryVisibleToGuests({
      isActive: row.isActive,
      status: row.status,
      startsAt: row.startsAt,
      expiresAt: row.expiresAt,
    })
  ) {
    throw new UploadError('NOT_FOUND', 'Story is not available', 404)
  }
  const guest = await lookupGuest(deviceToken)
  const guestId = guest?.id ?? null
  const existing = await prisma.storyView.findFirst({
    where: {
      storyId,
      OR: guestId ? [{ guestId }, { deviceId: deviceToken }] : [{ deviceId: deviceToken }],
    },
    select: { id: true },
  })
  if (!existing) {
    try {
      await prisma.storyView.create({
        data: { storyId, guestId, deviceId: deviceToken },
      })
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
        throw error
      }
    }
  }
  return listGuestStories(deviceToken)
}
