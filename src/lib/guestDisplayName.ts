export type GuestLanguage = 'AR' | 'HE' | 'EN'

export type TitleKey = 'mr' | 'mrs' | 'miss' | 'ms' | 'mr_mrs' | 'none'

export type FamilySuffixKey =
  | 'his_family'
  | 'her_family'
  | 'their_family'
  | 'the_family'
  | 'and_family'
  | 'amp_family'
  | 'and_their_family'
  | 'none'

export type GuestNameParts = {
  fullName: string
  language: GuestLanguage
  titleKey?: string | null
  includeFamily?: boolean | null
  familySuffixKey?: string | null
}

export const TITLE_KEYS = ['mr', 'mrs', 'miss', 'ms', 'mr_mrs', 'none'] as const
export const FAMILY_SUFFIX_KEYS = [
  'his_family',
  'her_family',
  'their_family',
  'the_family',
  'and_family',
  'amp_family',
  'and_their_family',
  'none',
] as const

type Option<T extends string> = { key: T; label: string }

export const TITLE_OPTIONS: Record<GuestLanguage, Option<TitleKey>[]> = {
  AR: [
    { key: 'mr', label: 'حضرة السيد' },
    { key: 'mrs', label: 'حضرة السيدة' },
    { key: 'miss', label: 'حضرة الآنسة' },
    { key: 'mr_mrs', label: 'حضرة السيد والسيدة' },
    { key: 'none', label: 'بدون لقب' },
  ],
  HE: [
    { key: 'mr', label: 'מר' },
    { key: 'mrs', label: 'גב׳' },
    { key: 'miss', label: 'העלמה' },
    { key: 'mr_mrs', label: 'מר וגברת' },
    { key: 'none', label: 'ללא תואר' },
  ],
  EN: [
    { key: 'mr', label: 'Mr.' },
    { key: 'mrs', label: 'Mrs.' },
    { key: 'ms', label: 'Ms.' },
    { key: 'miss', label: 'Miss' },
    { key: 'mr_mrs', label: 'Mr. & Mrs.' },
    { key: 'none', label: 'No title' },
  ],
}

export const FAMILY_SUFFIX_OPTIONS: Record<GuestLanguage, Option<FamilySuffixKey>[]> = {
  AR: [
    { key: 'his_family', label: 'وعائلته المحترمين' },
    { key: 'her_family', label: 'وعائلتها المحترمين' },
    { key: 'their_family', label: 'وعائلتهم المحترمين' },
    { key: 'the_family', label: 'والعائلة المحترمين' },
    { key: 'none', label: 'بدون إضافة' },
  ],
  HE: [
    { key: 'his_family', label: 'ומשפחתו' },
    { key: 'her_family', label: 'ומשפחתה' },
    { key: 'their_family', label: 'ומשפחתם' },
    { key: 'the_family', label: 'והמשפחה' },
    { key: 'none', label: 'ללא תוספת' },
  ],
  EN: [
    { key: 'and_family', label: 'and Family' },
    { key: 'amp_family', label: '& Family' },
    { key: 'and_their_family', label: 'and their Family' },
    { key: 'none', label: 'No suffix' },
  ],
}

const INCLUDE_FAMILY_LABEL: Record<GuestLanguage, string> = {
  AR: 'إضافة العائلة',
  HE: 'הוספת המשפחה',
  EN: 'Include family',
}

export function includeFamilyLabel(language: GuestLanguage): string {
  return INCLUDE_FAMILY_LABEL[language]
}

export function isRtlLanguage(language: GuestLanguage): boolean {
  return language === 'AR' || language === 'HE'
}

export function resolveTitleLabel(language: GuestLanguage, titleKey?: string | null): string {
  if (!titleKey || titleKey === 'none') return ''
  const option = TITLE_OPTIONS[language].find((o) => o.key === titleKey)
  return option?.label ?? ''
}

export function resolveFamilySuffixLabel(
  language: GuestLanguage,
  familySuffixKey?: string | null,
): string {
  if (!familySuffixKey || familySuffixKey === 'none') return ''
  const option = FAMILY_SUFFIX_OPTIONS[language].find((o) => o.key === familySuffixKey)
  return option?.label ?? ''
}

/** Remap keys when invitation language changes so options stay valid. */
export function adaptTitleKeyForLanguage(
  language: GuestLanguage,
  titleKey?: string | null,
): TitleKey | null {
  if (titleKey == null) return null
  if (TITLE_OPTIONS[language].some((o) => o.key === titleKey)) {
    return titleKey as TitleKey
  }
  if (titleKey === 'ms') return 'miss'
  return 'none'
}

export function adaptFamilySuffixKeyForLanguage(
  language: GuestLanguage,
  familySuffixKey?: string | null,
): FamilySuffixKey | null {
  if (familySuffixKey == null) return null
  if (FAMILY_SUFFIX_OPTIONS[language].some((o) => o.key === familySuffixKey)) {
    return familySuffixKey as FamilySuffixKey
  }

  const toRtl: Record<string, FamilySuffixKey> = {
    and_family: 'his_family',
    amp_family: 'his_family',
    and_their_family: 'their_family',
  }
  const toEn: Record<string, FamilySuffixKey> = {
    his_family: 'and_family',
    her_family: 'and_family',
    the_family: 'and_family',
    their_family: 'and_their_family',
  }

  if (language === 'EN') {
    return toEn[familySuffixKey] ?? 'none'
  }
  return toRtl[familySuffixKey] ?? 'none'
}

/**
 * Compose the final card name from stored parts.
 * Legacy guests (no titleKey / familySuffixKey) keep fullName as-is.
 */
export function composeGuestDisplayName(parts: GuestNameParts): string {
  const name = parts.fullName.trim()
  if (!name) return ''

  const hasStructuredTitle = parts.titleKey != null && parts.titleKey !== ''
  const hasStructuredFamily =
    Boolean(parts.includeFamily) &&
    parts.familySuffixKey != null &&
    parts.familySuffixKey !== '' &&
    parts.familySuffixKey !== 'none'

  // Pure legacy row: nothing structured stored → show fullName unchanged
  if (!hasStructuredTitle && !parts.includeFamily && parts.familySuffixKey == null) {
    return name
  }

  const segments: string[] = []
  const title = resolveTitleLabel(parts.language, parts.titleKey)
  if (title) segments.push(title)
  segments.push(name)
  if (hasStructuredFamily) {
    const suffix = resolveFamilySuffixLabel(parts.language, parts.familySuffixKey)
    if (suffix) segments.push(suffix)
  }
  return segments.join(' ')
}
