import { Button, Dialog, useToast } from '@/shared/ui'
import { PasswordFields } from './PasswordFields'
import { usePasswordChange } from './usePasswordChange'

/** «Сменить пароль» from the user menu. */
export function ChangePasswordDialog({ onClose }: { onClose: () => void }) {
  const toast = useToast()
  const form = usePasswordChange(() => {
    toast('Пароль изменён')
    onClose()
  })
  return (
    <Dialog
      open
      onClose={onClose}
      title="Смена пароля"
      description="На других устройствах после смены нужно будет войти заново."
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Отмена
          </Button>
          <Button size="sm" type="submit" form="password-form" disabled={form.pending}>
            {form.pending ? 'Сохраняем…' : 'Сменить пароль'}
          </Button>
        </>
      }
    >
      <form id="password-form" onSubmit={form.submit} className="grid gap-4">
        <PasswordFields form={form} currentLabel="Текущий пароль" />
      </form>
    </Dialog>
  )
}
