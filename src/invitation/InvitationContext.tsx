import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { InvitationPayload, Language, PublicEvent, PublicGuest } from '../api/client'
import { invitation as fallbackInvitation } from '../data/invitation'
import { isRtl, translate, type LocaleCode, type TranslationKey } from './i18n'

export type InvitationContent = {
  bride: string
  groom: string
  saveTheDate: string
  dateShort: string
  date: string
  time: string
  venue: string
  address: string
  tagline: string
  celebrationNote: string
  joinUsMessage: string
  returnToEnvelope: string
  message: string
  dearLine: string | null
  guestName: string | null
  language: LocaleCode
}

type InvitationContextValue = {
  token: string | null
  guest: PublicGuest | null
  event: PublicEvent | null
  calendar: InvitationPayload['calendar'] | null
  content: InvitationContent
  locale: LocaleCode
  setLocaleOverride: (locale: LocaleCode | null) => void
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string
  rtl: boolean
  refreshGuest: (guest: PublicGuest) => void
}

const InvitationContext = createContext<InvitationContextValue | null>(null)

function formatDateShort(iso: string): string {
  const d = new Date(iso)
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const yyyy = d.getUTCFullYear()
  return `${dd}.${mm}.${yyyy}`
}

function formatLongDate(iso: string, language: Language): string {
  const d = new Date(iso)
  return d.toLocaleDateString(language === 'AR' ? 'ar' : language === 'HE' ? 'he' : 'en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

function buildContent(
  locale: LocaleCode,
  guest: PublicGuest | null,
  event: PublicEvent | null,
  t: InvitationContextValue['t'],
): InvitationContent {
  if (!event) {
    return {
      bride: fallbackInvitation.bride,
      groom: fallbackInvitation.groom,
      saveTheDate: fallbackInvitation.saveTheDate,
      dateShort: fallbackInvitation.dateShort,
      date: fallbackInvitation.date,
      time: fallbackInvitation.time,
      venue: fallbackInvitation.venue,
      address: fallbackInvitation.address,
      tagline: fallbackInvitation.tagline,
      celebrationNote: fallbackInvitation.celebrationNote,
      joinUsMessage: t('joinUsMessage'),
      returnToEnvelope: t('returnToEnvelope'),
      message: fallbackInvitation.message,
      dearLine: null,
      guestName: null,
      language: locale,
    }
  }

  return {
    bride: event.brideName,
    groom: event.groomName,
    saveTheDate: formatDateShort(event.eventDate),
    dateShort: formatDateShort(event.eventDate),
    date: formatLongDate(event.eventDate, locale),
    time: event.eventStartTime,
    venue: event.venueName,
    address: event.venueAddress,
    tagline: event.tagline ?? fallbackInvitation.tagline,
    celebrationNote: event.celebrationNote ?? fallbackInvitation.celebrationNote,
    joinUsMessage: event.joinUsMessage ?? t('joinUsMessage'),
    returnToEnvelope: t('returnToEnvelope'),
    message: event.intro ?? fallbackInvitation.message,
    dearLine: guest ? t('dear', { name: guest.displayName }) : null,
    guestName: guest?.displayName ?? null,
    language: locale,
  }
}

export function InvitationProvider({
  children,
  token = null,
  initial,
}: {
  children: ReactNode
  token?: string | null
  initial?: InvitationPayload | null
}) {
  const [guest, setGuest] = useState<PublicGuest | null>(initial?.guest ?? null)
  const [event] = useState<PublicEvent | null>(initial?.event ?? null)
  const [calendar] = useState(initial?.calendar ?? null)
  const [localeOverride, setLocaleOverride] = useState<LocaleCode | null>(null)

  const locale: LocaleCode = localeOverride ?? guest?.language ?? 'EN'

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) => translate(locale, key, vars),
    [locale],
  )

  const content = useMemo(() => buildContent(locale, guest, event, t), [locale, guest, event, t])

  const value: InvitationContextValue = {
    token,
    guest,
    event,
    calendar,
    content,
    locale,
    setLocaleOverride,
    t,
    rtl: isRtl(locale),
    refreshGuest: setGuest,
  }

  return <InvitationContext.Provider value={value}>{children}</InvitationContext.Provider>
}

export function useInvitation() {
  const ctx = useContext(InvitationContext)
  if (!ctx) {
    const t = (key: TranslationKey, vars?: Record<string, string | number>) =>
      translate('EN', key, vars)
    return {
      token: null,
      guest: null,
      event: null,
      calendar: null,
      content: buildContent('EN', null, null, t),
      locale: 'EN' as LocaleCode,
      setLocaleOverride: () => undefined,
      t,
      rtl: false,
      refreshGuest: () => undefined,
    }
  }
  return ctx
}
