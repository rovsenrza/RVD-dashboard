import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

const button = cva(
  'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium whitespace-nowrap transition-[background-color,color,box-shadow] duration-150 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:pointer-events-none disabled:opacity-40',
  {
    variants: {
      variant: {
        primary:
          'bg-brand text-on-brand shadow-[inset_0_-1px_0_rgb(0_0_0/0.08)] hover:bg-brand-dark active:bg-brand-press',
        secondary:
          'bg-sheet text-ink shadow-[inset_0_0_0_1px_var(--color-line-strong)] hover:bg-sheet-muted',
        ghost: 'text-ink-secondary hover:bg-wash hover:text-ink',
        rail: 'text-rail-muted hover:bg-rail-hover hover:text-rail-ink',
        danger: 'bg-status-replace-ink text-sheet hover:bg-status-replace-ink/90',
      },
      size: {
        sm: 'h-8 px-2.5 py-1.5 text-ui',
        md: 'h-9 px-3.5 py-2 text-sm',
        icon: 'size-9 p-0',
        'icon-sm': 'size-8 p-0',
        auto: 'h-10 justify-start px-2 py-1 text-left font-normal',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof button> {
  icon?: LucideIcon
  trailingIcon?: LucideIcon
  children?: ReactNode
}

export function Button({
  variant,
  size,
  icon: Icon,
  trailingIcon: Trailing,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const iconSize = size === 'sm' || size === 'icon-sm' ? 15 : 16
  return (
    <button type={type} className={cn(button({ variant, size }), className)} {...rest}>
      {Icon && <Icon size={iconSize} strokeWidth={1.75} />}
      {children}
      {Trailing && <Trailing size={iconSize - 2} strokeWidth={1.75} className="opacity-60" />}
    </button>
  )
}
