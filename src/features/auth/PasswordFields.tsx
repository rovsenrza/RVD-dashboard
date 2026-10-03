import { MIN_PASSWORD_LENGTH } from '@/entities/user'
import { Field, Input } from '@/shared/ui'
import type { PasswordChangeForm } from './usePasswordChange'

/** The three fields of a password change, as the dialog and the first-sign-in screen ask them. */
export function PasswordFields({
  form,
  currentLabel,
}: {
  form: PasswordChangeForm
  currentLabel: string
}) {
  const { values, errors, set } = form
  return (
    <>
      <Field label={currentLabel} error={errors.current}>
        {(id) => (
          <Input
            id={id}
            type="password"
            autoComplete="current-password"
            autoFocus
            required
            value={values.current}
            aria-invalid={!!errors.current || undefined}
            onChange={set('current')}
          />
        )}
      </Field>
      <Field
        label="Новый пароль"
        hint={`Не короче ${MIN_PASSWORD_LENGTH} символов; фраза из нескольких слов подойдёт`}
        error={errors.next}
      >
        {(id) => (
          <Input
            id={id}
            type="password"
            autoComplete="new-password"
            required
            value={values.next}
            aria-invalid={!!errors.next || undefined}
            onChange={set('next')}
          />
        )}
      </Field>
      <Field label="Повторите новый пароль" error={errors.repeat}>
        {(id) => (
          <Input
            id={id}
            type="password"
            autoComplete="new-password"
            required
            value={values.repeat}
            aria-invalid={!!errors.repeat || undefined}
            onChange={set('repeat')}
          />
        )}
      </Field>
    </>
  )
}
