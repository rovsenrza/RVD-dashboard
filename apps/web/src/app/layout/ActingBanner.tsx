import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Eye } from 'lucide-react'
import { useSession } from '@/app/session'
import { Button, useToast } from '@/shared/ui'

/**
 * While a supplier's staff member looks at a company (customer, 2026-10-22): a rail-black
 * strip under the header — never mistaken for the company's own screen or for the 1С
 * banner — saying whose cabinet this is and as whom, with the way back.
 */
export function ActingBanner() {
  const { actingBy, company, user, stopActing } = useSession()
  const navigate = useNavigate()
  const toast = useToast()
  if (!actingBy) return null
  // Without a person chosen the staff member is the company's hidden administrator.
  const hidden = user.name.endsWith('(поставщик)')
  const back = async () => {
    try {
      await stopActing()
      navigate('/supplier', { replace: true })
    } catch {
      toast('Не удалось вернуться — обновите страницу', 'error')
    }
  }
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 bg-rail px-4 py-2.5 text-ui text-rail-ink lg:px-6"
    >
      <Eye size={16} strokeWidth={1.75} className="shrink-0 text-brand" aria-hidden />
      <p className="min-w-0 flex-1 max-sm:basis-[calc(100%-2rem)]">
        Кабинет компании <span className="font-medium">{company.name}</span>{' '}
        {hidden ? (
          'глазами её администратора'
        ) : (
          <>
            как <span className="font-medium">{user.name}</span>
          </>
        )}
        <span className="text-rail-muted max-md:hidden">
          {' '}
          · вы вошли как сотрудник поставщика, в списке пользователей компании вас нет
        </span>
      </p>
      <Button size="sm" icon={ArrowLeft} onClick={back} className="max-sm:w-full">
        Вернуться к компаниям
      </Button>
    </div>
  )
}
