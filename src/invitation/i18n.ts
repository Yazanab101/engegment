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
