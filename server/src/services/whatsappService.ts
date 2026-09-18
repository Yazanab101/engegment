import type { Language } from '@prisma/client'

export function buildWhatsAppInviteMessage(params: {
  language: Language
  fullName: string
  inviteUrl: string
}): string {
  const { language, fullName, inviteUrl } = params
  if (language === 'AR') {
    return `عزيزي/عزيزتي ${fullName}،\nيسعدنا أن تشاركونا يومنا المميز ❤️\nدعوتكم الشخصية:\n${inviteUrl}`
  }
  if (language === 'HE') {
    return `${fullName} היקר/ה,\nנשמח מאוד שתהיו איתנו ביום המיוחד שלנו ❤️\nההזמנה האישית שלכם:\n${inviteUrl}`
  }
  return `Dear ${fullName},\nWe would be delighted to celebrate this special day with you.\nYour personal invitation:\n${inviteUrl}`
}

export function whatsappShareUrl(phone: string | null | undefined, message: string): string {
  const digits = (phone ?? '').replace(/\D/g, '')
  const base = digits ? `https://wa.me/${digits}` : 'https://wa.me/'
  return `${base}?text=${encodeURIComponent(message)}`
}
