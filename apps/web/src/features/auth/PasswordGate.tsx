import { useSession } from '@/app/session'
import { Button, useToast } from '@/shared/ui'
import { AuthFrame } from './AuthFrame'
import { PasswordFields } from './PasswordFields'
import { usePasswordChange } from './usePasswordChange'

/**
 * The first sign-in with a password the administrator gave: the cabinet opens
 * once the person sets their own — until then the server shows them nothing.
 */
export function PasswordGate() {
  const { signOut } = useSession()
  const toast = useToast()
  const form = usePasswordChange(() => toast('Пароль сохранён — дальше входите с ним'))
  return (
    <AuthFrame
      title="Новый пароль"
      lead="Вы вошли с паролем от администратора. Придумайте свой — кабинет откроется сразу после этого."
      footer={
        <>
          Не сейчас?{' '}
          <Button variant="link" size="inline" onClick={signOut}>
            Выйти
          </Button>
        </>
      }
    >
      <form onSubmit={form.submit} className="grid gap-4">
        <PasswordFields form={form} currentLabel="Пароль от администратора" />
        <Button type="submit" disabled={form.pending} className="mt-1 w-full">
          {form.pending ? 'Сохраняем…' : 'Сохранить и войти'}
        </Button>
      </form>
    </AuthFrame>
  )
}
