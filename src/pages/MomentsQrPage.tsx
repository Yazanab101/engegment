import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import QRCode from 'qrcode'
import { memoriesApi } from '../moments/api'
import styles from './MomentsQrPage.module.css'

function engagementHeadline(names: string) {
  const parts = names
    .split(/\s*(?:&|و)\s*/g)
    .map((part) => part.trim())
    .filter(Boolean)
  const yazan = parts.find((part) => /يزن|yazan/i.test(part))
  const nora = parts.find((part) => /نورا|nora/i.test(part))
  if (yazan && nora) return 'خطوبة يزن & نورا'
  return names.trim() ? `خطوبة ${names.trim()}` : 'خطوبة يزن & نورا'
}

export function MomentsQrPage() {
  const [params, setParams] = useSearchParams()
  const [coupleNames, setCoupleNames] = useState('يزن & نورا')
  const [tableDraft, setTableDraft] = useState(params.get('t') ?? '')
  const [qrSrc, setQrSrc] = useState('')
  const table = params.get('t')?.trim().slice(0, 20) || null
  const pageUrl = useMemo(() => {
    const origin = window.location.origin
    return table ? `${origin}/moments?t=${encodeURIComponent(table)}` : `${origin}/moments`
  }, [table])

  useEffect(() => {
    void memoriesApi
      .event()
      .then((event) => {
        if (event.coupleNames?.trim()) setCoupleNames(event.coupleNames)
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    let cancelled = false
    void QRCode.toDataURL(pageUrl, {
      width: 1024,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#29120b', light: '#ffffff' },
    }).then((url) => {
      if (!cancelled) setQrSrc(url)
    })
    return () => {
      cancelled = true
    }
  }, [pageUrl])

  const applyTable = () => {
    const next = tableDraft.trim().slice(0, 20)
    const copy = new URLSearchParams(params)
    if (next) copy.set('t', next)
    else copy.delete('t')
    setParams(copy, { replace: true })
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(pageUrl)
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
        <p className={styles.kicker}>{engagementHeadline(coupleNames)}</p>
        <h1>شاركونا لحظاتكم</h1>
        <p className={styles.hint}>صوّروا الباركود من كاميرا الجوال لتفتح صفحة المشاركة</p>
        {qrSrc ? (
          <img className={styles.qr} src={qrSrc} alt="باركود صفحة اللحظات" width={320} height={320} />
        ) : (
          <div className={styles.qr} aria-hidden />
        )}
        {table ? <p className={styles.table}>طاولة {table}</p> : null}
        <p className={styles.url} dir="ltr">
          {pageUrl.replace(/^https?:\/\//, '')}
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
        <a className={styles.btnQuiet} href={qrSrc || undefined} download="moments-qr.png">
          تحميل الصورة
        </a>
        <button className={styles.link} type="button" onClick={() => void copyLink()}>
          نسخ الرابط
        </button>
      </div>
    </div>
  )
}
