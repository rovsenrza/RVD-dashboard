import { useState, type FormEvent } from 'react'
import { KeyRound, UserX, UserCheck } from 'lucide-react'
import type { CabinetUser, UserRole } from '@/entities/types'
import { ROLE_LABEL, ROLE_ORDER, ROLE_SCOPE, isBranchBound } from '@/entities/user'
import { useSession } from '@/app/session'
import { ApiError } from '@/shared/api/client'
import { useResetPassword, useSaveUser } from '@/shared/api/queries'
import { Button, Checkbox, Dialog, Field, Input, Select, useToast } from '@/shared/ui'

/** Creates a user (`user` null) or edits one; access and password actions only for an existing user. */
export function UserDialog({ user, onClose }: { user: CabinetUser | null; onClose: () => void }) {
  const session = useSession()
  const toast = useToast()
  const save = useSaveUser()
  const reset = useResetPassword()
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [role, setRole] = useState<UserRole>(user?.role ?? 'mechanic')
  // «All branches» is its own choice, so unticking the last branch never flips into it.
  const [everywhere, setEverywhere] = useState(
    !!user && !isBranchBound(user.role) && user.branchIds.length === 0,
  )
  const [branchIds, setBranchIds] = useState<string[]>(
    user?.branchIds.length ? user.branchIds : [session.branches[0].id],
  )
  const [emailError, setEmailError] = useState<string>()

  const bound = isBranchBound(role)
  const isSelf = user?.id === session.user.id

  const changeRole = (next: UserRole) => {
    setRole(next)
    // A mechanic works in exactly one branch; keep the first one they had.
    if (isBranchBound(next)) setBranchIds([branchIds[0] ?? session.branches[0].id])
  }

  const toggleBranch = (id: string, on: boolean) =>
    setBranchIds((ids) => (on ? [...ids, id] : ids.filter((x) => x !== id)))

  const fail = (error: Error) => {
    if (error instanceof ApiError && error.status === 409) setEmailError(error.message)
    else toast('Не удалось сохранить, попробуйте ещё раз', 'error')
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const scope = bound
      ? branchIds.slice(0, 1)
      : everywhere
        ? []
        : branchIds.length
          ? branchIds
          : [session.branches[0].id]
    save.mutate(
      { id: user?.id, name: name.trim(), email: email.trim(), role, branchIds: scope },
      {
        onSuccess: () => {
          toast(user ? 'Изменения сохранены' : 'Пользователь добавлен, приглашение отправлено')
          onClose()
        },
        onError: fail,
      },
    )
  }

  const setActive = (active: boolean) =>
    save.mutate(
      { id: user!.id, active },
      {
        onSuccess: () => {
          toast(active ? 'Доступ возвращён' : 'Доступ отключён')
          onClose()
        },
        onError: fail,
      },
    )

  return (
    <Dialog
      open
      onClose={onClose}
      title={user ? user.name : 'Новый пользователь'}
      description={
        user
          ? 'Роль и филиалы определяют, что человек видит в кабинете.'
          : 'После сохранения на почту уйдёт приглашение со ссылкой для входа.'
      }
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Отмена
          </Button>
          <Button size="sm" type="submit" form="user-form" disabled={save.isPending}>
            {save.isPending ? 'Сохраняем…' : user ? 'Сохранить' : 'Добавить'}
          </Button>
        </>
      }
    >
      <form id="user-form" onSubmit={submit} className="grid gap-4">
        <Field label="ФИО">
          {(id) => (
            <Input id={id} required value={name} onChange={(e) => setName(e.target.value)} />
          )}
        </Field>
        <Field
          label="Почта"
          hint="На неё приходят приглашение и ссылка для смены пароля"
          error={emailError}
        >
          {(id) => (
            <Input
              id={id}
              type="email"
              required
              value={email}
              aria-invalid={!!emailError || undefined}
              onChange={(e) => {
                setEmail(e.target.value)
                setEmailError(undefined)
              }}
            />
          )}
        </Field>
        <Field label="Роль" hint={ROLE_SCOPE[role]}>
          {(id) => (
            <Select
              id={id}
              value={role}
              disabled={isSelf}
              onChange={(e) => changeRole(e.target.value as UserRole)}
              options={ROLE_ORDER.map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
            />
          )}
        </Field>

        {bound ? (
          <Field label="Филиал" hint="Механик видит технику и изделия только своего филиала">
            {(id) => (
              <Select
                id={id}
                value={branchIds[0]}
                onChange={(e) => setBranchIds([e.target.value])}
                options={session.branches.map((b) => ({ value: b.id, label: b.name }))}
              />
            )}
          </Field>
        ) : (
          <fieldset className="grid gap-2.5">
            <legend className="mb-1.5 text-ui font-medium">Филиалы</legend>
            <Checkbox
              label="Все филиалы компании"
              hint="Включая филиалы, которые появятся позже"
              checked={everywhere}
              onChange={(e) => setEverywhere(e.target.checked)}
            />
            {session.branches.map((b) => (
              <Checkbox
                key={b.id}
                label={b.name}
                className="pl-7"
                disabled={everywhere}
                checked={everywhere || branchIds.includes(b.id)}
                onChange={(e) => toggleBranch(b.id, e.target.checked)}
              />
            ))}
          </fieldset>
        )}

        {user && (
          <div className="grid gap-2 border-t border-line pt-4">
            <div className="text-ui font-medium">Доступ</div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                icon={KeyRound}
                disabled={reset.isPending || !user.active}
                onClick={() =>
                  reset.mutate(user.id, {
                    onSuccess: ({ sentTo }) =>
                      toast(`Ссылка для нового пароля отправлена на ${sentTo}`),
                    onError: () => toast('Не удалось отправить ссылку', 'error'),
                  })
                }
              >
                Сбросить пароль
              </Button>
              {user.active ? (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={UserX}
                  disabled={isSelf || save.isPending}
                  onClick={() => setActive(false)}
                  className="text-status-replace-ink"
                >
                  Отключить доступ
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={UserCheck}
                  disabled={save.isPending}
                  onClick={() => setActive(true)}
                >
                  Вернуть доступ
                </Button>
              )}
            </div>
            {isSelf && (
              <p className="text-label text-ink-muted">
                Свою роль и доступ меняет другой администратор.
              </p>
            )}
          </div>
        )}
      </form>
    </Dialog>
  )
}
