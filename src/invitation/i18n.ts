import en from '../locales/en.json'
import ar from '../locales/ar.json'
import he from '../locales/he.json'

export type LocaleCode = 'EN' | 'AR' | 'HE'
export type TranslationKey = keyof typeof en

const catalogs: Record<LocaleCode, Record<string, string>> = {
  EN: en,
  AR: ar,
  HE: he,
}

export function isRtl(locale: LocaleCode): boolean {
  return locale === 'AR' || locale === 'HE'
}

const INVITE_LANG_KEY = 'invitation.language'

function storageKey(token?: string | null) {
  return token ? `${INVITE_LANG_KEY}.${token}` : INVITE_LANG_KEY
}

export function rememberInviteLocale(locale: LocaleCode, token?: string | null) {
  try {
    if (token) window.localStorage.setItem(storageKey(token), locale)
  } catch {
    /* ignore */
  }
}

export function guessInviteLocale(token?: string | null): LocaleCode | null {
  if (typeof window === 'undefined') return null
  const query = new URLSearchParams(window.location.search).get('lang')?.toLowerCase()
  if (query === 'he' || query === 'iw') return 'HE'
  if (query === 'ar') return 'AR'
  if (query === 'en') return 'EN'
  if (token) {
    try {
      const stored = window.localStorage.getItem(storageKey(token))
      if (stored === 'HE' || stored === 'AR' || stored === 'EN') return stored
    } catch {
      /* ignore */
    }
  }
  const nav = `${navigator.language} ${(navigator.languages ?? []).join(' ')}`.toLowerCase()
  if (/(^|[\s,_-])(he|iw)/.test(nav) || nav.includes('hebrew')) return 'HE'
  if (/(^|[\s,_-])ar/.test(nav) || nav.includes('arabic')) return 'AR'
  return null
}

export function translate(
  locale: LocaleCode,
  key: TranslationKey,
  vars?: Record<string, string | number>,
): string {
  const template = catalogs[locale][key] ?? catalogs.EN[key] ?? key
  if (!vars) return template
  return Object.entries(vars).reduce(
    (acc, [k, v]) => acc.replaceAll(`{{${k}}}`, String(v)),
    template,
  )
}
