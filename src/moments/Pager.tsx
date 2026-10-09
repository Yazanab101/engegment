import { fillCopy, type GuestCopy } from './guest-copy'

export const MINE_PAGE_SIZE = 6
export const GALLERY_PAGE_SIZE = 12

export function pageCount(total: number, size: number) {
  return Math.max(1, Math.ceil(Math.max(0, total) / size))
}

export function slicePage<T>(items: T[], page: number, size: number) {
  const pages = pageCount(items.length, size)
  const safe = Math.min(Math.max(0, page), pages - 1)
  return {
    page: safe,
    pages,
    slice: items.slice(safe * size, (safe + 1) * size),
  }
}

export function Pager({
  page,
  pages,
  copy,
  onPage,
}: {
  page: number
  pages: number
  copy: GuestCopy
  onPage: (next: number) => void
}) {
  if (pages <= 1) return null
  return (
    <nav className="moments-pager" aria-label={copy.pagination}>
      <button
        type="button"
        className="moments-btn-quiet moments-btn-small"
        disabled={page <= 0}
        onClick={() => onPage(page - 1)}
      >
        {copy.pagePrev}
      </button>
      <span className="moments-pager-status">{fillCopy(copy.pageStatus, { current: page + 1, total: pages })}</span>
      <button
        type="button"
        className="moments-btn-quiet moments-btn-small"
        disabled={page >= pages - 1}
        onClick={() => onPage(page + 1)}
      >
        {copy.pageNext}
      </button>
    </nav>
  )
}

export function LazyThumb({ src }: { src: string | null }) {
  if (!src) return <div className="moments-video-placeholder" />
  return <img src={src} alt="" loading="eager" decoding="async" />
}
