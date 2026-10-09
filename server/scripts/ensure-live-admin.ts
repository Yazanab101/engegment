import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../src/lib/auth.ts'

const prisma = new PrismaClient()

async function main() {
  const password = process.env.LIVE_DASH_PASS
  if (!password) throw new Error('LIVE_DASH_PASS is required')
  const email = 'yazan'
  const passwordHash = await hashPassword(password)
  const row = await prisma.adminUser.upsert({
    where: { email },
    update: { passwordHash, name: 'Yazan' },
    create: { email, passwordHash, name: 'Yazan' },
  })
  console.log('live-dash-admin-ready', row.email)
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'failed')
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
