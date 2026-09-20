import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutBucketCorsCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { env } from '../config/env.js'
import { PRESIGN_TTL_SECONDS } from './upload-config.js'

function required(name: keyof typeof env, value?: string) {
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

let client: S3Client | undefined

export function getR2Client() {
  if (client) return client
  client = new S3Client({
    region: 'auto',
    endpoint: required('R2_ENDPOINT', env.R2_ENDPOINT),
    credentials: {
      accessKeyId: required('R2_ACCESS_KEY_ID', env.R2_ACCESS_KEY_ID),
      secretAccessKey: required('R2_SECRET_ACCESS_KEY', env.R2_SECRET_ACCESS_KEY),
    },
  })
  return client
}

export function getR2Bucket() {
  return env.R2_BUCKET_NAME || 'engagement-memories'
}

export async function signR2PutUrl(objectKey: string, mimeType: string, expiresIn = PRESIGN_TTL_SECONDS) {
  return getSignedUrl(
    getR2Client(),
    new PutObjectCommand({
      Bucket: getR2Bucket(),
      Key: objectKey,
      ContentType: mimeType,
    }),
    { expiresIn },
  )
}

export async function getR2Object(objectKey: string, range?: string) {
  return getR2Client().send(
    new GetObjectCommand({
      Bucket: getR2Bucket(),
      Key: objectKey,
      ...(range ? { Range: range } : {}),
    }),
  )
}

export async function signR2GetUrl(objectKey: string, expiresIn: number) {
  return getSignedUrl(
    getR2Client(),
    new GetObjectCommand({
      Bucket: getR2Bucket(),
      Key: objectKey,
    }),
    { expiresIn },
  )
}

export async function headR2Object(objectKey: string) {
  try {
    const result = await getR2Client().send(
      new HeadObjectCommand({ Bucket: getR2Bucket(), Key: objectKey }),
    )
    return {
      contentLength: result.ContentLength ?? 0,
      contentType: result.ContentType ?? null,
    }
  } catch {
    return null
  }
}

export async function ensureR2Cors() {
  const origins = new Set(
    [env.PUBLIC_APP_URL, ...env.CORS_ORIGIN.split(',')]
      .map((value) => value.trim().replace(/\/$/, ''))
      .filter(Boolean),
  )
  origins.add('https://engegment-one.vercel.app')
  await getR2Client().send(
    new PutBucketCorsCommand({
      Bucket: getR2Bucket(),
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: [...origins],
            AllowedMethods: ['GET', 'PUT', 'HEAD'],
            AllowedHeaders: ['*'],
            ExposeHeaders: ['ETag', 'Content-Type', 'Content-Length', 'Accept-Ranges'],
            MaxAgeSeconds: 86400,
          },
        ],
      },
    }),
  )
}

export async function putR2Object(objectKey: string, body: Buffer, contentType: string) {
  await getR2Client().send(
    new PutObjectCommand({
      Bucket: getR2Bucket(),
      Key: objectKey,
      Body: body,
      ContentType: contentType,
    }),
  )
}

export async function deleteR2Objects(keys: string[]) {
  const unique = [...new Set(keys.filter(Boolean))]
  if (!unique.length) return
  await getR2Client().send(
    new DeleteObjectsCommand({
      Bucket: getR2Bucket(),
      Delete: { Objects: unique.map((Key) => ({ Key })), Quiet: true },
    }),
  )
}
