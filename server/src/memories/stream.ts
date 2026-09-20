import type { GetObjectCommandOutput } from '@aws-sdk/client-s3'
import type { Response } from 'express'
import { Readable } from 'node:stream'

export function sendR2Body(
  res: Response,
  object: GetObjectCommandOutput,
  mimeType: string | null,
  ranged: boolean,
) {
  res.setHeader('Content-Type', mimeType || 'application/octet-stream')
  res.setHeader('Accept-Ranges', 'bytes')
  res.setHeader('Cache-Control', 'private, max-age=120')
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin')
  if (object.ContentLength != null) res.setHeader('Content-Length', String(object.ContentLength))
  if (ranged && object.ContentRange) {
    res.status(206)
    res.setHeader('Content-Range', object.ContentRange)
  }
  const body = object.Body
  if (!body) {
    res.status(404).end()
    return
  }
  if (body instanceof Readable) {
    body.pipe(res)
    return
  }
  void body.transformToByteArray().then((bytes) => res.end(Buffer.from(bytes)))
}
