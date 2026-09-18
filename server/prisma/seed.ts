import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../src/lib/auth.js'
import { generateInviteToken } from '../src/lib/tokens.js'

const prisma = new PrismaClient()

async function main() {
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL ?? 'admin@example.com'
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD ?? 'ChangeMeNow!123'

  await prisma.adminUser.upsert({
    where: { email: email.toLowerCase() },
    update: {},
    create: {
      email: email.toLowerCase(),
      passwordHash: await hashPassword(password),
      name: 'Admin',
    },
  })

  const event = await prisma.event.upsert({
    where: { slug: 'current' },
    update: {},
    create: {
      slug: 'current',
      title: 'Engagement Celebration',
      brideName: 'Ashley',
      groomName: 'Matthew',
      eventDate: new Date('2026-11-21T00:00:00.000Z'),
      eventStartTime: '18:00',
      venueName: 'The Grand Estate',
      venueAddress: '124 Rosewood Lane, Napa Valley, California',
      googleMapsUrl: 'https://maps.google.com/?q=Napa+Valley',
      wazeUrl: 'https://waze.com/ul?q=Napa%20Valley',
      contactPhone: '+10000000000',
      whatsappPhone: '10000000000',
      rsvpDeadline: new Date('2026-11-14T23:59:59.000Z'),
      dressCode: 'Formal attire',
      parkingInfo: 'Valet parking available',
      introEn: 'With joyful hearts, we invite you to celebrate our engagement.',
      introAr: 'بقلوب فرحة، ندعوكم للاحتفال بخطوبتنا.',
      introHe: 'בלב שמח, נשמח לראותכם בחגיגת האירוסין שלנו.',
      footerEn: 'We can\'t wait to celebrate with you.',
      footerAr: 'ننتظركم بفارغ الصبر.',
      footerHe: 'מחכים לחגוג איתכם.',
      taglineEn: 'Our forever\nbegins here',
      taglineAr: 'للأبد\nيبدأ من هنا',
      taglineHe: 'הנצח שלנו\nמתחיל כאן',
      joinUsMessageEn: 'We hope you\'ll join us',
      joinUsMessageAr: 'نأمل أن تشاركونا',
      joinUsMessageHe: 'נשמח שתצטרפו אלינו',
      celebrationNoteEn: 'A celebration\nis on its way',
      celebrationNoteAr: 'احتفال\nفي الطريق',
      celebrationNoteHe: 'חגיגה\nבדרך',
    },
  })

  const existing = await prisma.guest.count({ where: { eventId: event.id } })
  if (existing === 0) {
    await prisma.guest.create({
      data: {
        eventId: event.id,
        fullName: 'John Smith',
        language: 'EN',
        maxGuestsAllowed: 2,
        inviteToken: generateInviteToken(),
        phoneNumber: '+15551234567',
        rsvp: { create: { status: 'PENDING', guestCount: 0 } },
      },
    })
  }

  console.log('Seed complete')
  console.log(`Admin: ${email}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
