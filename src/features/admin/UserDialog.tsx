import { useState, type FormEvent } from 'react'
import { KeyRound, UserX, UserCheck } from 'lucide-react'
import type { CabinetUser, PasswordDelivery, UserRole } from '@/entities/types'
import { EMAIL_TAKEN, ROLE_LABEL, ROLE_ORDER, ROLE_SCOPE, isBranchBound } from '@/entities/user'
import { useSession } from '@/app/session'
import { ApiError } from '@/shared/api/client'
import { useResetPassword, useSaveUser } from '@/shared/api/queries'
import { Button, Checkbox, Dialog, Field, Input, Select, useToast } from '@/shared/ui'
import { PasswordHandover } from './PasswordHandover'

/**
 * Creates a user (`user` null) or edits one; access and password actions only for an existing user.
 * A live cabinet has no mail yet: a new or reset password comes back once, for the administrator to
 * pass on, and the dialog turns into that hand-over.
 */
export function UserDialog({ user, onClose }: { user: CabinetUser | null; onClose: () => void }) {
  const session = useSession()
  const toast = useToast()
  const save = useSaveUser()
  const reset = useResetPassword()
  // 1С keeps no branches of the client yet: then everyone works across the whole company.
  const firstBranch = session.branches[0]?.id
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [role, setRole] = useState<UserRole>(user?.role ?? (firstBranch ? 'mechanic' : 'engineer'))
  // «All branches» is its own choice, so unticking the last branch never flips into it.
  const [everywhere, setEverywhere] = useState(
    !!user && !isBranchBound(user.role) && user.branchIds.length === 0,
  )
  const [branchIds, setBranchIds] = useState<string[]>(
    user?.branchIds.length ? user.branchIds : firstBranch ? [firstBranch] : [],
  )
  const [emailError, setEmailError] = useState<string>()
  const [handover, setHandover] = useState<{ email: string; password: string } | null>(null)

  const bound = isBranchBound(role)
  const isSelf = user?.id === session.user.id
  // A mechanic is defined by their branch: without branches the role has nothing to hold on to.
  const roles = ROLE_ORDER.filter((r) => firstBranch || !isBranchBound(r) || user?.role === r)

  const changeRole = (next: UserRole) => {
    setRole(next)
    // A mechanic works in exactly one branch; keep the first one they had.
    const keep = branchIds[0] ?? firstBranch
    if (isBranchBound(next) && keep) setBranchIds([keep])
  }

  const toggleBranch = (id: string, on: boolean) =>
    setBranchIds((ids) => (on ? [...ids, id] : ids.filter((x) => x !== id)))

  const fail = (error: Error) => {
    if (error instanceof ApiError && error.message === EMAIL_TAKEN) setEmailError(error.message)
    else if (error instanceof ApiError && error.status < 500) toast(error.message, 'error')
    else toast('Не удалось сохранить, попробуйте ещё раз', 'error')
  }

  /** The new password went out by mail, or it is shown here, once, to be passed on. */
  const deliver = (delivery: PasswordDelivery, to: string, mailed: string, then?: () => void) => {
    if (delivery.kind === 'email') {
      toast(mailed)
      then?.()
    } else setHandover({ email: to, password: delivery.password })
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const scope = !firstBranch
      ? []
      : bound
        ? branchIds.slice(0, 1)
        : everywhere
          ? []
          : branchIds.length
            ? branchIds
            : [firstBranch]
    save.mutate(
      { id: user?.id, name: name.trim(), email: email.trim(), role, branchIds: scope },
      {
        onSuccess: ({ user: saved, delivery }) => {
          if (delivery)
            deliver(delivery, saved.email, 'Пользователь добавлен, приглашение отправлено', onClose)
          else {
            toast('Изменения сохранены')
            onClose()
          }
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

  if (handover)
    return (
      <Dialog
        open
        onClose={onClose}
        title={user ? user.name : name.trim()}
        description="Передайте почту и пароль сотруднику. При первом входе кабинет попросит придумать свой пароль."
        footer={
          <Button size="sm" onClick={onClose}>
            Готово
          </Button>
        }
      >
        <PasswordHandover email={handover.email} password={handover.password} />
      </Dialog>
    )

  return (
    <Dialog
      open
      onClose={onClose}
      title={user ? user.name : 'Новый пользователь'}
      description={
        user
          ? firstBranch
            ? 'Роль и филиалы определяют, что человек видит в кабинете.'
            : 'Роль определяет, что человек видит в кабинете.'
          : session.demo
            ? 'После сохранения на почту уйдёт приглашение со ссылкой для входа.'
            : 'После сохранения покажем пароль для первого входа — его нужно передать сотруднику.'
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
          hint={
            session.demo
              ? 'На неё приходят приглашение и ссылка для смены пароля'
              : 'С ней сотрудник входит в кабинет'
          }
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
              options={roles.map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
            />
          )}
        </Field>

        {firstBranch &&
          (bound ? (
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
          ))}

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
                    onSuccess: (delivery) =>
                      deliver(
                        delivery,
                        user.email,
                        `Ссылка для нового пароля отправлена на ${user.email}`,
                      ),
                    onError: () => toast('Не удалось сбросить пароль, попробуйте ещё раз', 'error'),
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
