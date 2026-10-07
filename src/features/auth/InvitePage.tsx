import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { MIN_PASSWORD_LENGTH, passwordProblem } from '@/entities/user'
import { ApiError } from '@/shared/api/client'
import { useAcceptInvite, useInvite } from '@/shared/api/queries'
import { Button, Field, Input, Skeleton } from '@/shared/ui'
import { AuthFrame } from './AuthFrame'

const toSignIn = (
  <>
    Уже есть пароль?{' '}
    <Link to="/login" className="font-medium text-brand-deep hover:underline">
      Войти
    </Link>
  </>
)

/**
 * The link from an invitation or a reset letter (with mail, question 7): the
 * person sets their own password and the cabinet opens. A spent or old link
 * says so and sends them to the administrator.
 */
export function InvitePage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const invite = useInvite(token)
  const accept = useAcceptInvite()
  const [next, setNext] = useState('')
  const [repeat, setRepeat] = useState('')
  const [errors, setErrors] = useState<{ next?: string; repeat?: string; link?: string }>({})

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const weak = passwordProblem(next)
    if (weak) return setErrors({ next: weak })
    if (repeat !== next) return setErrors({ repeat: 'Пароли не совпадают' })
    accept.mutate(
      { token, password: next },
      {
        // The server set the session cookie: a fresh load opens the cabinet signed in.
        onSuccess: () => window.location.assign('/'),
        onError: (error) =>
          setErrors(
            error instanceof ApiError && error.status === 400
              ? { next: error.message }
              : { link: error.message },
          ),
      },
    )
  }

  if (!token || invite.isError || errors.link)
    return (
      <AuthFrame
        title="Ссылка не работает"
        lead={
          errors.link ??
          'Ссылка недействительна или устарела — попросите администратора прислать новую.'
        }
        footer={null}
      >
        <Button className="w-full" onClick={() => window.location.assign('/login')}>
          На страницу входа
        </Button>
      </AuthFrame>
    )

  return (
    <AuthFrame
      title="Задайте пароль"
      lead={
        invite.data
          ? `${invite.data.name}, придумайте пароль — с ним и адресом ${invite.data.email} вы будете входить в кабинет.`
          : 'Проверяем ссылку…'
      }
      footer={toSignIn}
    >
      {invite.isPending ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <form onSubmit={submit} className="grid gap-4">
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
                autoFocus
                required
                value={next}
                aria-invalid={!!errors.next || undefined}
                onChange={(e) => {
                  setNext(e.target.value)
                  setErrors({})
                }}
              />
            )}
          </Field>
          <Field label="Повторите пароль" error={errors.repeat}>
            {(id) => (
              <Input
                id={id}
                type="password"
                autoComplete="new-password"
                required
                value={repeat}
                aria-invalid={!!errors.repeat || undefined}
                onChange={(e) => {
                  setRepeat(e.target.value)
                  setErrors({})
                }}
              />
            )}
          </Field>
          <Button type="submit" disabled={accept.isPending} className="mt-1 w-full">
            {accept.isPending ? 'Сохраняем…' : 'Сохранить и войти'}
          </Button>
        </form>
      )}
    </AuthFrame>
  )
}
