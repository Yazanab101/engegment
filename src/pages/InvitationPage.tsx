import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api, type InvitationPayload } from '../api/client'
import { InvitationProvider, useInvitation } from '../invitation/InvitationContext'
import { OpeningExperience } from '../components/OpeningExperience'
import styles from './InvitationPage.module.css'

export function InvitationPage() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<InvitationPayload | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    ;(async () => {
      try {
        const payload = await api.getInvitation(token)
        if (cancelled) return
        setData(payload)
        void api.openInvitation(token)
      } catch {
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  if (loading) {
    return (
      <div className={styles.state}>
        <p>Opening your invitation…</p>
      </div>
    )
  }

  if (error || !data || !token) {
    return <InvalidInvitation />
  }

  return (
    <InvitationProvider token={token} initial={data}>
      <InvalidIfNeeded>
        <OpeningExperience />
      </InvalidIfNeeded>
    </InvitationProvider>
  )
}

function InvalidInvitation() {
  return (
    <div className={styles.state} dir="auto">
      <p>This invitation link is invalid or no longer available.</p>
      <p>رابط الدعوة غير صالح أو لم يعد متاحاً.</p>
      <p>קישור ההזמנה אינו תקין או שאינו זמין יותר.</p>
    </div>
  )
}

function InvalidIfNeeded({ children }: { children: React.ReactNode }) {
  const { t } = useInvitation()
  void t
  return <>{children}</>
}
