import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useSession } from '@/app/session'
import { ApiError } from '@/shared/api/client'
import { useForgotPassword } from '@/shared/api/queries'
import { Button, Field, Input } from '@/shared/ui'
import { AuthFrame } from './AuthFrame'

/**
 * «Забыли пароль?» (customer, 2026-10-22): a link to set a new password, sent only to the
 * supplier's own addresses. The answer reads the same either way, so it tells no one
 * whether an address is in the cabinet; a client's people ask their administrator.
 */
function ForgotPassword({ initial, onBack }: { initial: string; onBack: () => void }) {
  const [email, setEmail] = useState(initial)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const forgot = useForgotPassword()

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    forgot.mutate(email.trim(), {
      onSuccess: () => setSentTo(email.trim()),
      onError: (err) =>
        setError(
          err instanceof ApiError && err.status === 429
            ? err.message
            : 'Не удалось отправить — попробуйте ещё раз',
        ),
    })
  }

  const back = (
    <Button variant="link" size="inline" onClick={onBack}>
      Вернуться ко входу
    </Button>
  )

  if (sentTo)
    return (
      <AuthFrame
        title="Проверьте почту"
        lead={`Если ${sentTo} — адрес сотрудника поставщика в кабинете, на него ушла ссылка для нового пароля. Она действует 48 часов.`}
        footer={back}
      >
        <p className="text-ui text-ink-muted">
          Письма нет через несколько минут — проверьте «Спам» или запросите ссылку ещё раз.
        </p>
      </AuthFrame>
    )

  return (
    <AuthFrame
      title="Новый пароль по почте"
      lead="Для сотрудников поставщика: ссылка уходит только на адреса @vgiz.ru и @snabsv.ru."
      footer={<>Сотрудникам клиентов пароль сбрасывает администратор их компании. {back}</>}
    >
      <form onSubmit={submit} className="grid gap-4">
        <Field label="Электронная почта" error={error ?? undefined}>
          {(id) => (
            <Input
              id={id}
              type="email"
              autoComplete="username"
              autoFocus
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ivanov@vgiz.ru"
            />
          )}
        </Field>
        <Button type="submit" disabled={forgot.isPending} className="mt-1 w-full">
          {forgot.isPending ? 'Отправляем…' : 'Прислать ссылку'}
        </Button>
      </form>
    </AuthFrame>
  )
}

export function LoginPage() {
  const { ready, authenticated, signIn } = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [forgot, setForgot] = useState(false)

  const from = (location.state as { from?: string } | null)?.from ?? '/'

  if (!ready) return null
  if (authenticated) return <Navigate to={from} replace />
  if (forgot) return <ForgotPassword initial={email} onBack={() => setForgot(false)} />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setPending(true)
    try {
      await signIn(email, password)
      navigate(from, { replace: true })
    } catch (err) {
      setPending(false)
      setError(
        // Too many wrong passwords: the server says how long to wait.
        err instanceof ApiError && err.status === 429
          ? err.message
          : err instanceof ApiError && err.status !== 401
            ? 'Не удалось войти — попробуйте ещё раз'
            : 'Неверный логин или пароль',
      )
    }
  }

  return (
    <AuthFrame
      title="Вход"
      lead="Доступ выдаёт ваш поставщик РВД."
      footer="Нет доступа? Обратитесь к вашему специалисту поставщика."
    >
      <form onSubmit={submit} className="grid gap-4">
        <Field label="Электронная почта">
          {(id) => (
            <Input
              id={id}
              type="email"
              autoComplete="username"
              autoFocus
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ivanov@company.ru"
            />
          )}
        </Field>
        <div className="relative grid">
          <Field label="Пароль" error={error ?? undefined}>
            {(id) => (
              <Input
                id={id}
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            )}
          </Field>
          {/* Drawn beside the label, reached after the password in the tab order. */}
          <Button
            variant="link"
            size="inline"
            className="absolute top-0 right-0 text-label"
            onClick={() => setForgot(true)}
          >
            Забыли пароль?
          </Button>
        </div>
        <Button type="submit" disabled={pending} className="mt-1 w-full">
          {pending ? 'Входим…' : 'Войти'}
        </Button>
      </form>
    </AuthFrame>
  )
}
