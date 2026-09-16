import { Menu } from 'lucide-react'
import { initials, useSession } from '@/app/session'
import { Button } from '@/shared/ui'

export function Header({ onMenu }: { onMenu: () => void }) {
  const { user, branch } = useSession()
  return (
    <header className="flex h-14 items-center gap-3 border-b border-line bg-surface px-4">
      <Button
        variant="ghost"
        size="icon"
        icon={Menu}
        className="lg:hidden"
        onClick={onMenu}
        aria-label="Открыть меню"
      />
      <div className="text-sm text-ink-muted">{branch.name}</div>
      <div className="ml-auto flex items-center gap-3 text-sm">
        <span className="hidden sm:inline">{user.name}</span>
        <Avatar name={user.name} />
      </div>
    </header>
  )
}

function Avatar({ name }: { name: string }) {
  return (
    <span
      className="grid size-8 place-items-center rounded-full bg-brand text-xs font-semibold text-ink"
      title={name}
    >
      {initials(name)}
    </span>
  )
}
