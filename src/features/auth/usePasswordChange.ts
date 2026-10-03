import { useState, type ChangeEvent, type FormEvent } from 'react'
import { passwordProblem, WRONG_CURRENT_PASSWORD } from '@/entities/user'
import { useSession } from '@/app/session'
import { ApiError } from '@/shared/api/client'
import { useToast } from '@/shared/ui'

type Key = 'current' | 'next' | 'repeat'

export interface PasswordChangeForm {
  values: Record<Key, string>
  errors: Partial<Record<Key, string>>
  pending: boolean
  set: (key: Key) => (e: ChangeEvent<HTMLInputElement>) => void
  submit: (e: FormEvent) => void
}

/**
 * A password change: the new one is checked by the shared rule before the
 * server sees it, and a refusal lands under the field it is about.
 */
export function usePasswordChange(onDone: () => void): PasswordChangeForm {
  const { changePassword } = useSession()
  const toast = useToast()
  const [values, setValues] = useState<Record<Key, string>>({ current: '', next: '', repeat: '' })
  const [errors, setErrors] = useState<Partial<Record<Key, string>>>({})
  const [pending, setPending] = useState(false)

  const set = (key: Key) => (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setValues((v) => ({ ...v, [key]: value }))
    setErrors((v) => ({ ...v, [key]: undefined }))
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const weak =
      passwordProblem(values.next) ??
      (values.next === values.current ? 'Новый пароль совпадает с текущим' : null)
    if (weak) return setErrors({ next: weak })
    if (values.repeat !== values.next) return setErrors({ repeat: 'Пароли не совпадают' })
    setPending(true)
    try {
      await changePassword(values.current, values.next)
      onDone()
    } catch (error) {
      setPending(false)
      if (error instanceof ApiError && error.status === 400)
        setErrors(
          error.message === WRONG_CURRENT_PASSWORD
            ? { current: error.message }
            : { next: error.message },
        )
      else toast('Не удалось сменить пароль — попробуйте ещё раз', 'error')
    }
  }

  return { values, errors, pending, set, submit: (e) => void submit(e) }
}
