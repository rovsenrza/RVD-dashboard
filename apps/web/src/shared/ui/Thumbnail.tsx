import { useState, type ReactNode } from 'react'
import { ImageOff, LoaderCircle } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

/**
 * A square image tile: a photo in a grid or strip. With `onClick` it is a
 * button (opens the viewer); `busy` covers it while the file is on its way.
 */
export function Thumbnail({
  src,
  alt,
  onClick,
  busy = false,
  className,
  children,
}: {
  src: string
  alt: string
  onClick?: () => void
  busy?: boolean
  className?: string
  /** Overlay content, e.g. a remove button in a form */
  children?: ReactNode
}) {
  const [broken, setBroken] = useState(false)
  const image = broken ? (
    <span className="grid size-full place-items-center text-ink-faint">
      <ImageOff size={18} strokeWidth={1.75} role="img" aria-label={alt} />
    </span>
  ) : (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setBroken(true)}
      className={cn(
        'size-full object-cover transition-[filter] duration-150',
        onClick && 'group-hover:brightness-90',
        busy && 'opacity-50',
      )}
    />
  )
  const tile = cn(
    'group relative block aspect-square overflow-hidden rounded-lg bg-field',
    className,
  )
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        tile,
        'cursor-zoom-in outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
      )}
    >
      {image}
      {children}
    </button>
  ) : (
    <div className={tile}>
      {image}
      {busy && (
        <span className="absolute inset-0 grid place-items-center text-ink">
          <LoaderCircle size={20} strokeWidth={1.75} className="animate-spin" aria-hidden />
        </span>
      )}
      {children}
    </div>
  )
}
