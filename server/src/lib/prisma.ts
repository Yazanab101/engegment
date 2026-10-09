import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
  prismaKeepAlive?: ReturnType<typeof setInterval>
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

globalForPrisma.prisma = prisma

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

export async function connectPrisma() {
  const started = Date.now()
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      await withTimeout(prisma.$connect(), 8_000, 'prisma.$connect')
      await withTimeout(prisma.$queryRaw`SELECT 1`, 5_000, 'prisma ping')
      console.log(`Prisma connected in ${Date.now() - started}ms`)
      break
    } catch (error) {
      console.error(
        `Prisma connect attempt ${attempt}/5 failed`,
        error instanceof Error ? error.message : error,
      )
      if (attempt === 5) {
        console.error('Starting API without a warm DB connection; requests may fail until DB recovers')
        break
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000))
    }
  }

  if (!globalForPrisma.prismaKeepAlive) {
    globalForPrisma.prismaKeepAlive = setInterval(() => {
      void prisma.$queryRaw`SELECT 1`.catch(() => undefined)
    }, 55_000)
    globalForPrisma.prismaKeepAlive.unref?.()
  }
}
