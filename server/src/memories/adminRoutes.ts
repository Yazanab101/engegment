import { Router } from 'express'
import { z } from 'zod'
import { asyncHandler } from '../lib/errors.js'
import { requireAdmin, type AuthedRequest } from '../middleware/auth.js'
import { sendR2Body } from './stream.js'
import {
  adminGetGuest,
  adminGuestDownloadUrls,
  adminListGuests,
  adminListMedia,
  adminListMessages,
  adminMediaAccessUrl,
  adminMediaObject,
  adminOverview,
  adminUpdateMedia,
  adminUpdateMessage,
  assertAdminRateLimit,
  setUploadsOpen,
  toAppError,
} from './service.js'
import {
  adminStoryAccessUrl,
  authorizeStoryUpload,
  confirmStoryUpload,
  deleteStory,
  listAdminStories,
  reorderStories,
  updateStory,
} from './storyService.js'

export const memoriesAdminRouter = Router()
memoriesAdminRouter.use(requireAdmin)

function wrap<T>(fn: () => Promise<T>) {
  return fn().catch((error) => {
    throw toAppError(error)
  })
}

memoriesAdminRouter.get(
  '/overview',
  asyncHandler(async (req: AuthedRequest, res) => {
    if (req.admin) assertAdminRateLimit(req.admin.id)
    res.json(await wrap(() => adminOverview()))
  }),
)

memoriesAdminRouter.get(
  '/guests',
  asyncHandler(async (req: AuthedRequest, res) => {
    if (req.admin) assertAdminRateLimit(req.admin.id)
    const query = z
      .object({
        search: z.string().max(60).optional().default(''),
        sort: z.enum(['activity', 'name', 'photos', 'videos', 'uploads']).optional().default('activity'),
      })
      .parse(req.query)
    res.json(await wrap(() => adminListGuests(query)))
  }),
)

memoriesAdminRouter.get(
  '/guests/:id/download-urls',
  asyncHandler(async (req: AuthedRequest, res) => {
    if (req.admin) assertAdminRateLimit(req.admin.id)
    res.json(await wrap(() => adminGuestDownloadUrls(String(req.params.id))))
  }),
)

memoriesAdminRouter.get(
  '/guests/:id',
  asyncHandler(async (req: AuthedRequest, res) => {
    if (req.admin) assertAdminRateLimit(req.admin.id)
    res.json(await wrap(() => adminGetGuest(String(req.params.id))))
  }),
)

memoriesAdminRouter.get(
  '/media',
  asyncHandler(async (req: AuthedRequest, res) => {
    if (req.admin) assertAdminRateLimit(req.admin.id)
    const query = z
      .object({
        filter: z.enum(['all', 'photos', 'videos', 'favorites', 'hidden']).optional().default('all'),
        guestId: z.string().min(8).max(80).optional().nullable(),
        page: z.coerce.number().int().min(1).max(500).optional().default(1),
        limit: z.coerce.number().int().min(1).max(200).optional().default(40),
      })
      .parse(req.query)
    res.json(await wrap(() => adminListMedia(query)))
  }),
)

memoriesAdminRouter.post(
  '/media/action',
  asyncHandler(async (req: AuthedRequest, res) => {
    if (req.admin) assertAdminRateLimit(req.admin.id)
    const body = z
      .object({
        ids: z.array(z.string().uuid()).min(1).max(200),
        action: z.enum(['favorite', 'unfavorite', 'hide', 'unhide', 'delete']),
      })
      .parse(req.body)
    res.json(await wrap(() => adminUpdateMedia(body.ids, body.action)))
  }),
)

memoriesAdminRouter.get(
  '/media/:id/file',
  asyncHandler(async (req: AuthedRequest, res) => {
    if (req.admin) assertAdminRateLimit(req.admin.id)
    const range = typeof req.headers.range === 'string' ? req.headers.range : undefined
    const { object, mimeType } = await wrap(() => adminMediaObject(String(req.params.id), range))
    sendR2Body(res, object, mimeType, Boolean(range))
  }),
)

memoriesAdminRouter.post(
  '/media/:id/signed-url',
  asyncHandler(async (req: AuthedRequest, res) => {
    if (req.admin) assertAdminRateLimit(req.admin.id)
    res.json(await wrap(() => adminMediaAccessUrl(String(req.params.id))))
  }),
)

memoriesAdminRouter.get(
  '/messages',
  asyncHandler(async (req: AuthedRequest, res) => {
    if (req.admin) assertAdminRateLimit(req.admin.id)
    const query = z
      .object({
        archived: z.enum(['true', 'false']).optional(),
        guestId: z.string().min(8).max(80).optional(),
      })
      .parse(req.query)
    res.json(await wrap(() => adminListMessages(query.archived === 'true', query.guestId)))
  }),
)

memoriesAdminRouter.post(
  '/messages/:id/action',
  asyncHandler(async (req: AuthedRequest, res) => {
    if (req.admin) assertAdminRateLimit(req.admin.id)
    const body = z
      .object({
        action: z.enum(['favorite', 'unfavorite', 'archive', 'unarchive', 'delete']),
      })
      .parse(req.body)
    res.json(await wrap(() => adminUpdateMessage(String(req.params.id), body.action)))
  }),
)

memoriesAdminRouter.post(
  '/uploads-open',
  asyncHandler(async (req: AuthedRequest, res) => {
    if (req.admin) assertAdminRateLimit(req.admin.id)
    const body = z.object({ open: z.boolean() }).parse(req.body)
    res.json(await wrap(() => setUploadsOpen(body.open)))
  }),
)

const expireMode = z.enum(['event_day', 'none', 'custom'])

memoriesAdminRouter.get(
  '/stories',
  asyncHandler(async (req: AuthedRequest, res) => {
    if (req.admin) assertAdminRateLimit(req.admin.id)
    res.json(await wrap(() => listAdminStories()))
  }),
)

memoriesAdminRouter.post(
  '/stories/authorize',
  asyncHandler(async (req: AuthedRequest, res) => {
    if (!req.admin) throw toAppError(new Error('UNAUTHORIZED'))
    assertAdminRateLimit(req.admin.id)
    const body = z
      .object({
        mimeType: z.string().min(3).max(100),
        fileSize: z.number().int().positive(),
        mediaType: z.enum(['photo', 'video']),
        hasThumb: z.boolean().optional().default(false),
        duration: z.number().positive().nullable().optional(),
        expireMode: expireMode.optional().default('event_day'),
        customExpiresAt: z.string().max(40).nullable().optional(),
        startsAt: z.string().max(40).nullable().optional(),
        isActive: z.boolean().optional(),
      })
      .parse(req.body)
    res.json(
      await wrap(() =>
        authorizeStoryUpload({
          userId: req.admin!.id,
          mimeType: body.mimeType,
          fileSize: body.fileSize,
          mediaType: body.mediaType,
          hasThumb: body.hasThumb,
          duration: body.duration,
          expireMode: body.expireMode,
          customExpiresAt: body.customExpiresAt,
          startsAt: body.startsAt,
          isActive: body.isActive,
        }),
      ),
    )
  }),
)

memoriesAdminRouter.post(
  '/stories/confirm',
  asyncHandler(async (req: AuthedRequest, res) => {
    if (!req.admin) throw toAppError(new Error('UNAUTHORIZED'))
    assertAdminRateLimit(req.admin.id)
    const body = z
      .object({
        storyId: z.string().uuid(),
        objectKey: z.string().min(8).max(400),
        thumbnailObjectKey: z.string().min(8).max(400).nullable().optional(),
        fileSize: z.number().int().nonnegative(),
        mimeType: z.string().min(3).max(100),
        duration: z.number().positive().nullable().optional(),
        activate: z.boolean().optional(),
      })
      .parse(req.body)
    res.json(
      await wrap(() =>
        confirmStoryUpload({
          userId: req.admin!.id,
          storyId: body.storyId,
          objectKey: body.objectKey,
          thumbnailObjectKey: body.thumbnailObjectKey,
          fileSize: body.fileSize,
          mimeType: body.mimeType,
          duration: body.duration,
          activate: body.activate,
        }),
      ),
    )
  }),
)

memoriesAdminRouter.post(
  '/stories/reorder',
  asyncHandler(async (req: AuthedRequest, res) => {
    if (req.admin) assertAdminRateLimit(req.admin.id)
    const body = z.object({ storyIds: z.array(z.string().uuid()).max(200) }).parse(req.body)
    res.json(await wrap(() => reorderStories(body.storyIds)))
  }),
)

memoriesAdminRouter.post(
  '/stories/:id/signed-url',
  asyncHandler(async (req: AuthedRequest, res) => {
    if (req.admin) assertAdminRateLimit(req.admin.id)
    res.json(await wrap(() => adminStoryAccessUrl(String(req.params.id))))
  }),
)

memoriesAdminRouter.patch(
  '/stories/:id',
  asyncHandler(async (req: AuthedRequest, res) => {
    if (req.admin) assertAdminRateLimit(req.admin.id)
    const body = z
      .object({
        isActive: z.boolean().optional(),
        duration: z.number().positive().nullable().optional(),
        startsAt: z.string().max(40).nullable().optional(),
        expiresAt: z.string().max(40).nullable().optional(),
        expireMode: expireMode.optional(),
        customExpiresAt: z.string().max(40).nullable().optional(),
      })
      .parse(req.body)
    res.json(await wrap(() => updateStory({ storyId: String(req.params.id), ...body })))
  }),
)

memoriesAdminRouter.delete(
  '/stories/:id',
  asyncHandler(async (req: AuthedRequest, res) => {
    if (req.admin) assertAdminRateLimit(req.admin.id)
    res.json(await wrap(() => deleteStory(String(req.params.id))))
  }),
)
