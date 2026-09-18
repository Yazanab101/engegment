export type CalendarPlatform = 'ios' | 'android' | 'desktop'

/**
 * Detect calendar target platform without relying on userAgent alone.
 * Modern iPads often report as MacIntel; maxTouchPoints distinguishes them.
 */
export function getCalendarPlatform(): CalendarPlatform {
  if (typeof navigator === 'undefined') return 'desktop'

  const ua = navigator.userAgent || ''
  const platform = navigator.platform || ''

  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (platform === 'MacIntel' && navigator.maxTouchPoints > 1)

  const isAndroid = /Android/i.test(ua)

  if (isIOS) return 'ios'
  if (isAndroid) return 'android'
  return 'desktop'
}
