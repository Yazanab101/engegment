export type MomentsLang = 'ar' | 'he' | 'en'

const LANG_KEY = 'moments.guest.lang'

const NAMES: Record<MomentsLang, { yazan: string; nora: string; two: string; one: string; fallback: string }> = {
  ar: {
    yazan: 'يزن',
    nora: 'نورا',
    two: 'خطوبة {a} & {b}',
    one: 'خطوبة {name}',
    fallback: 'خطوبة يزن & نورا',
  },
  he: {
    yazan: 'יזן',
    nora: 'נורה',
    two: 'האירוסין של {a} & {b}',
    one: 'האירוסין של {name}',
    fallback: 'האירוסין של יזן & נורה',
  },
  en: {
    yazan: 'Yazan',
    nora: 'Nora',
    two: '{a} & {b} — Engagement',
    one: '{name} — Engagement',
    fallback: 'Yazan & Nora — Engagement',
  },
}

export function momentsLang(raw: string | null | undefined): MomentsLang {
  const value = (raw ?? 'ar').toLowerCase()
  if (value.startsWith('he') || value.startsWith('iw')) return 'he'
  if (value.startsWith('en')) return 'en'
  return 'ar'
}

export function momentsDir(lang: MomentsLang): 'rtl' | 'ltr' {
  return lang === 'en' ? 'ltr' : 'rtl'
}

export function readMomentsLanguage(): MomentsLang | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = window.localStorage.getItem(LANG_KEY)
    if (stored === 'ar' || stored === 'he' || stored === 'en') return stored
  } catch {
    /* ignore */
  }
  return null
}

export function saveMomentsLanguage(lang: MomentsLang) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LANG_KEY, lang)
  } catch {
    /* ignore */
  }
}

export function coupleParts(names: string) {
  const parts = names
    .split(/\s*(?:&|\sو\s)\s*/g)
    .map((part) => part.trim())
    .filter(Boolean)
  const yazan = parts.find((part) => /يزن|yazan|יזן/i.test(part))
  const nora = parts.find((part) => /نورا|nora|נורה/i.test(part))
  if (yazan && nora) return [yazan, nora]
  return parts.slice(0, 2)
}

export function engagementHeadline(names: string, lang: MomentsLang = 'ar') {
  const copy = NAMES[lang] ?? NAMES.ar
  const parts = coupleParts(names).map((part) => {
    if (/يزن|yazan|יזן/i.test(part)) return copy.yazan
    if (/نورا|nora|נורה/i.test(part)) return copy.nora
    return part
  })
  if (parts.length >= 2) return copy.two.replace('{a}', parts[0]!).replace('{b}', parts[1]!)
  if (names.trim()) return copy.one.replace('{name}', names.trim())
  return copy.fallback
}
