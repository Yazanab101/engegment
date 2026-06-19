import styles from './FloralAccent.module.css'

const FLORAL_TOP =
  'https://images.unsplash.com/photo-1490750967868-88ea4486c946?w=500&q=90&auto=format&fit=crop'
const FLORAL_BOTTOM =
  'https://images.unsplash.com/photo-1455659814943-ff596d609977?w=500&q=90&auto=format&fit=crop'

interface FloralAccentProps {
  position: 'top-left' | 'bottom-right'
}

export function FloralAccent({ position }: FloralAccentProps) {
  const src = position === 'top-left' ? FLORAL_TOP : FLORAL_BOTTOM

  return (
    <div
      className={`${styles.accent} ${position === 'top-left' ? styles.topLeft : styles.bottomRight}`}
      aria-hidden
    >
      <img src={src} alt="" loading="eager" decoding="async" />
    </div>
  )
}
