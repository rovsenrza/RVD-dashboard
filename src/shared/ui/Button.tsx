import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

const button = cva(
  'inline-flex items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand/60 disabled:pointer-events-none disabled:opacity-40',
  {
    variants: {
      variant: {
        primary: 'bg-brand text-ink hover:bg-brand-dark',
        secondary: 'border border-line bg-surface text-ink hover:bg-surface-muted',
        ghost: 'text-ink-muted hover:bg-surface-muted hover:text-ink',
        danger: 'bg-status-replace text-white hover:bg-status-replace/90',
      },
      size: {
        sm: 'h-7 px-2.5 text-xs',
        md: 'h-9 px-3 text-sm',
        icon: 'size-8 p-0',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof button> {
  icon?: LucideIcon
  children?: ReactNode
}

export function Button({
  variant,
  size,
  icon: Icon,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const iconSize = size === 'sm' ? 12 : 14
  return (
    <button type={type} className={cn(button({ variant, size }), className)} {...rest}>
      {Icon && <Icon size={size === 'icon' ? 16 : iconSize} />}
      {children}
    </button>
  )
}
