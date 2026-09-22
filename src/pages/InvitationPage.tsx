import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api, type InvitationPayload } from '../api/client'
import { InvitationProvider, useInvitation } from '../invitation/InvitationContext'
import {
  guessInviteLocale,
  isRtl,
  rememberInviteLocale,
  translate,
  type LocaleCode,
} from '../invitation/i18n'
import { OpeningExperience } from '../components/OpeningExperience'
import styles from './InvitationPage.module.css'

function localeLangAttr(locale: LocaleCode) {
  return locale === 'HE' ? 'he' : locale === 'AR' ? 'ar' : 'en'
}

export function InvitationPage() {
  const { token } = useParams<{ token: string }>()
  const guessed = useMemo(() => guessInviteLocale(token), [token])
  const [data, setData] = useState<InvitationPayload | null>(null)
  const [errorKind, setErrorKind] = useState<'network' | 'invalid' | null>(null)
  const [loading, setLoading] = useState(true)
  const [retryKey, setRetryKey] = useState(0)
  const locale = guessed ?? 'EN'
  const dir = guessed ? (isRtl(guessed) ? 'rtl' : 'ltr') : 'auto'
  const lang = guessed ? localeLangAttr(guessed) : undefined

  useEffect(() => {
    if (!token) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setErrorKind(null)
      try {
        const payload = await api.getInvitation(token)
        if (cancelled) return
        rememberInviteLocale(payload.guest.language, token)
        setData(payload)
        void api.openInvitation(token).catch(() => undefined)
      } catch (err) {
        if (cancelled) return
        setData(null)
        const message = err instanceof Error ? err.message.toLowerCase() : ''
        setErrorKind(
          message.includes('not found') || message.includes('not available')
            ? 'invalid'
            : 'network',
        )
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, retryKey])

  if (loading) {
    return (
      <div className={styles.state} dir={dir} lang={lang}>
        {guessed ? <p>{translate(guessed, 'loading')}</p> : <span className={styles.spinner} />}
      </div>
    )
  }

  if (errorKind === 'network') {
    return (
      <div className={styles.state} dir={dir} lang={lang}>
        <p>{translate(locale, 'loadError')}</p>
        <button
          type="button"
          className={styles.retry}
          onClick={() => setRetryKey((k) => k + 1)}
        >
          {translate(locale, 'retry')}
        </button>
      </div>
    )
  }

  if (errorKind === 'invalid' || !data || !token) {
    return (
      <div className={styles.state} dir={dir} lang={lang}>
        <p>{translate(locale, 'invalidInvitation')}</p>
      </div>
    )
  }

  return (
    <InvitationProvider token={token} initial={data}>
      <InvalidIfNeeded>
        <OpeningExperience />
      </InvalidIfNeeded>
    </InvitationProvider>
  )
}

function InvalidIfNeeded({ children }: { children: React.ReactNode }) {
  const { t } = useInvitation()
  void t
  return <>{children}</>
}
