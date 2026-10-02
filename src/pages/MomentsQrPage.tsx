import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import QRCode from 'qrcode'
import { memoriesApi } from '../moments/api'
import styles from './MomentsQrPage.module.css'

function coupleHeadline(names: string) {
  const parts = names
    .split(/\s*(?:&|و)\s*/g)
    .map((p) => p.trim())
    .filter(Boolean)
  const yazan = parts.find((p) => /يزن|yazan/i.test(p))
  const nora = parts.find((p) => /نورا|nora/i.test(p))
  if (yazan && nora) return 'خطوبة يزن & نورا'
  if (names.trim()) return `خطوبة ${names.trim()}`
  return 'خطوبة يزن & نورا'
}

export function MomentsQrPage() {
  const [params, setParams] = useSearchParams()
  const [coupleNames, setCoupleNames] = useState('يزن & نورا')
  const [tableDraft, setTableDraft] = useState(params.get('t') ?? '')
  const [qrDataUrl, setQrDataUrl] = useState('')
  const table = params.get('t')?.trim().slice(0, 20) || null

  const shareUrl = useMemo(() => {
    const origin = window.location.origin
    return table ? `${origin}/moments?t=${encodeURIComponent(table)}` : `${origin}/moments`
  }, [table])

  useEffect(() => {
    memoriesApi
      .event()
      .then((event) => {
        if (event.coupleNames?.trim()) setCoupleNames(event.coupleNames.trim())
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    let cancelled = false
    void QRCode.toDataURL(shareUrl, {
      width: 1024,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#29120b', light: '#ffffff' },
    }).then((url) => {
      if (!cancelled) setQrDataUrl(url)
    })
    return () => {
      cancelled = true
    }
  }, [shareUrl])

  function applyTable() {
    const next = tableDraft.trim().slice(0, 20)
    const updated = new URLSearchParams(params)
    if (next) updated.set('t', next)
    else updated.delete('t')
    setParams(updated, { replace: true })
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className={styles.page} dir="rtl">
      <article className={styles.card}>
        <p className={styles.mono} dir="ltr">
          Y · N
        </p>
        <div className={styles.line} />
        <p className={styles.kicker}>{coupleHeadline(coupleNames)}</p>
        <h1>شاركونا لحظاتكم</h1>
        <p className={styles.hint}>صوّروا الباركود من كاميرا الجوال لتفتح صفحة المشاركة</p>
        {qrDataUrl ? (
          <img className={styles.qr} src={qrDataUrl} alt="باركود صفحة اللحظات" width={320} height={320} />
        ) : (
          <div className={styles.qr} aria-hidden />
        )}
        {table ? <p className={styles.table}>طاولة {table}</p> : null}
        <p className={styles.url} dir="ltr">
          {shareUrl.replace(/^https?:\/\//, '')}
        </p>
      </article>

      <div className={styles.actions}>
        <label className={styles.tableField}>
          رقم الطاولة (اختياري)
          <input
            value={tableDraft}
            maxLength={20}
            onChange={(e) => setTableDraft(e.target.value)}
            onBlur={applyTable}
            onKeyDown={(e) => {
              if (e.key === 'Enter') applyTable()
            }}
            placeholder="مثلاً 12"
          />
        </label>
        <button className={styles.btn} type="button" onClick={() => window.print()}>
          طباعة الباركود
        </button>
        <a className={styles.btnQuiet} href={qrDataUrl || undefined} download="moments-qr.png">
          تحميل الصورة
        </a>
        <button className={styles.link} type="button" onClick={() => void copyLink()}>
          نسخ الرابط
        </button>
      </div>
    </div>
  )
}
