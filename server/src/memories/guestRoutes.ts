import { Router } from 'express'
import { z } from 'zod'
import { asyncHandler } from '../lib/errors.js'
import { sendR2Body } from './stream.js'
import {
  authorizeGuestUpload,
  confirmGuestUpload,
  deleteGuestMedia,
  finalizeGuestCaptions,
  getMemoryEventPublic,
  getMemoryGuestState,
  guestMediaAccessUrl,
  guestMediaObject,
  identifyMemoryGuest,
  saveGuestVideoThumbnail,
  sendMemoryMessage,
  toAppError,
  updateGuestCaption,
} from './service.js'
import { guestStoryAccessUrl, listGuestStories, markStoryViewed } from './storyService.js'

export const mediaGuestRouter = Router()

const token = z.string().min(20).max(120).regex(/^[A-Za-z0-9_-]+$/)
const idSchema = z.string().min(8).max(80)

function wrap<T>(fn: () => Promise<T>) {
  return fn().catch((error) => {
    throw toAppError(error)
  })
}

mediaGuestRouter.get(
  '/event',
  asyncHandler(async (_req, res) => {
    res.json(await wrap(() => getMemoryEventPublic()))
  }),
)

mediaGuestRouter.post(
  '/identify',
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        deviceToken: token,
        name: z.string().min(1).max(60),
        table: z.string().max(20).optional().nullable(),
      })
      .parse(req.body)
    res.json(
      await wrap(() =>
        identifyMemoryGuest({
          deviceToken: body.deviceToken,
          name: body.name,
          table: body.table,
        }),
      ),
    )
  }),
)

mediaGuestRouter.post(
  '/me',
  asyncHandler(async (req, res) => {
    const body = z.object({ deviceToken: token }).parse(req.body)
    res.json(await wrap(() => getMemoryGuestState(body.deviceToken)))
  }),
)

mediaGuestRouter.post(
  '/stories',
  asyncHandler(async (req, res) => {
    const body = z.object({ deviceToken: token }).parse(req.body)
    res.json(await wrap(() => listGuestStories(body.deviceToken)))
  }),
)

mediaGuestRouter.post(
  '/stories/signed-url',
  asyncHandler(async (req, res) => {
    const body = z.object({ deviceToken: token, storyId: idSchema }).parse(req.body)
    res.json(await wrap(() => guestStoryAccessUrl(body.deviceToken, body.storyId)))
  }),
)

mediaGuestRouter.post(
  '/stories/view',
  asyncHandler(async (req, res) => {
    const body = z.object({ deviceToken: token, storyId: idSchema }).parse(req.body)
    res.json(await wrap(() => markStoryViewed(body.deviceToken, body.storyId)))
  }),
)

mediaGuestRouter.post(
  '/upload-url',
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        deviceToken: token,
        eventId: idSchema,
        uploadSessionId: z.string().min(8).max(80).optional().nullable(),
        clientUploadId: z.string().uuid(),
        originalFilename: z.string().min(1).max(240),
        mimeType: z.string().min(3).max(100),
        fileSize: z.number().int().positive(),
        mediaType: z.enum(['photo', 'video']),
        hasThumb: z.boolean().optional(),
        table: z.string().max(20).optional().nullable(),
      })
      .parse(req.body)
    res.json(await wrap(() => authorizeGuestUpload(body)))
  }),
)

mediaGuestRouter.post(
  '/confirm',
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        deviceToken: token,
        uploadId: z.string().uuid(),
        objectKey: z.string().min(8).max(400),
        fileSize: z.number().int().nonnegative(),
        mimeType: z.string().min(3).max(100),
        width: z.number().int().positive().optional().nullable(),
        height: z.number().int().positive().optional().nullable(),
        duration: z.number().nonnegative().optional().nullable(),
        thumbnailObjectKey: z.string().max(400).optional().nullable(),
      })
      .parse(req.body)
    res.json(await wrap(() => confirmGuestUpload(body)))
  }),
)

mediaGuestRouter.get(
  '/file/:id',
  asyncHandler(async (req, res) => {
    const query = z.object({ token }).parse(req.query)
    const range = typeof req.headers.range === 'string' ? req.headers.range : undefined
    const { object, mimeType } = await wrap(() => guestMediaObject(query.token, String(req.params.id), range))
    sendR2Body(res, object, mimeType, Boolean(range))
  }),
)

mediaGuestRouter.post(
  '/thumbnail',
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        deviceToken: token,
        mediaId: z.string().uuid(),
        image: z.string().min(80).max(800_000),
      })
      .parse(req.body)
    res.json(await wrap(() => saveGuestVideoThumbnail(body.deviceToken, body.mediaId, body.image)))
  }),
)

mediaGuestRouter.post(
  '/signed-url',
  asyncHandler(async (req, res) => {
    const body = z.object({ deviceToken: token, mediaId: z.string().uuid() }).parse(req.body)
    res.json(await wrap(() => guestMediaAccessUrl(body.deviceToken, body.mediaId)))
  }),
)

mediaGuestRouter.post(
  '/message',
  asyncHandler(async (req, res) => {
    const body = z.object({ deviceToken: token, message: z.string().min(1).max(1000) }).parse(req.body)
    res.json(await wrap(() => sendMemoryMessage(body.deviceToken, body.message)))
  }),
)

mediaGuestRouter.post(
  '/finalize',
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        deviceToken: token,
        mediaIds: z.array(z.string().uuid()).max(20).default([]),
        caption: z.string().max(600).optional().nullable(),
      })
      .parse(req.body)
    res.json(await wrap(() => finalizeGuestCaptions(body)))
  }),
)

mediaGuestRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const body = z.object({ deviceToken: token, caption: z.string().max(600) }).parse(req.body)
    res.json(
      await wrap(() =>
        updateGuestCaption({
          deviceToken: body.deviceToken,
          mediaId: String(req.params.id),
          caption: body.caption,
        }),
      ),
    )
  }),
)

mediaGuestRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const body = z.object({ deviceToken: token }).parse(req.body ?? {})
    res.json(await wrap(() => deleteGuestMedia(body.deviceToken, String(req.params.id))))
  }),
)
