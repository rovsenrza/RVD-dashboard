import { useState, type FormEvent } from 'react'
import type { CabinetSettings } from '@/entities/types'
import { useSaveSettings, useSettings } from '@/shared/api/queries'
import { Button, Card, Checkbox, Field, Input, QueryState, Skeleton, useToast } from '@/shared/ui'

const LEAD_OPTIONS = [60, 30, 14, 7, 3, 1]

export function SettingsTab() {
  const settings = useSettings()
  return (
    <QueryState query={settings} skeleton={<Skeleton className="h-72 w-full rounded-sheet" />}>
      {(saved) => <SettingsForm saved={saved} />}
    </QueryState>
  )
}

function SettingsForm({ saved }: { saved: CabinetSettings }) {
  const toast = useToast()
  const save = useSaveSettings()
  const [warn, setWarn] = useState(String(saved.warnPercent))
  const [leadDays, setLeadDays] = useState(saved.leadDays)
  const [email, setEmail] = useState(saved.channels.email)

  const warnPercent = Number(warn)
  const warnValid = Number.isInteger(warnPercent) && warnPercent >= 5 && warnPercent <= 50
  const next: CabinetSettings = {
    warnPercent,
    leadDays: [...leadDays].sort((a, b) => b - a),
    channels: { inApp: true, email },
  }
  const dirty = JSON.stringify(next) !== JSON.stringify(saved)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!warnValid) return
    save.mutate(next, {
      onSuccess: () =>
        toast(
          next.warnPercent !== saved.warnPercent
            ? 'Настройки сохранены, статусы изделий пересчитаны'
            : 'Настройки сохранены',
        ),
      onError: () => toast('Не удалось сохранить настройки', 'error'),
    })
  }

  return (
    <form onSubmit={submit} className="grid gap-5">
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Card title="Состояние ресурса">
          <Field
            label="«Внимание», когда ресурса осталось меньше"
            hint={`Сейчас: ${saved.warnPercent} % срока эксплуатации. От 5 до 50 %. Статусы пересчитываются сразу после сохранения.`}
            error={warn && !warnValid ? 'Введите целое число от 5 до 50' : undefined}
          >
            {(id) => (
              <div className="flex items-center gap-2">
                <Input
                  id={id}
                  inputMode="numeric"
                  value={warn}
                  required
                  aria-invalid={!warnValid || undefined}
                  onChange={(e) => setWarn(e.target.value.replace(/\D/g, '').slice(0, 2))}
                  className="w-24 tabular"
                />
                <span className="text-ink-muted">%</span>
              </div>
            )}
          </Field>
        </Card>

        <Card title="Уведомления">
          <fieldset className="grid gap-2.5">
            <legend className="mb-1.5 text-ui font-medium">
              Предупреждать о конце гарантии, плановой замене и перепробеге
            </legend>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {LEAD_OPTIONS.map((d) => (
                <Checkbox
                  key={d}
                  label={`за ${d} ${d === 1 ? 'день' : d < 5 ? 'дня' : 'дней'}`}
                  checked={leadDays.includes(d)}
                  onChange={(e) =>
                    setLeadDays((list) =>
                      e.target.checked ? [...list, d] : list.filter((x) => x !== d),
                    )
                  }
                />
              ))}
            </div>
          </fieldset>
          <fieldset className="mt-5 grid gap-2.5 border-t border-line pt-4">
            <legend className="sr-only">Каналы</legend>
            <Checkbox label="В кабинете — колокольчик" hint="Включено всегда" checked disabled />
            <Checkbox
              label="Электронная почта"
              hint="Письма пойдут, когда будет настроен почтовый сервер"
              checked={email}
              onChange={(e) => setEmail(e.target.checked)}
            />
          </fieldset>
        </Card>
      </div>

      <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          disabled={!dirty || save.isPending}
          onClick={() => {
            setWarn(String(saved.warnPercent))
            setLeadDays(saved.leadDays)
            setEmail(saved.channels.email)
          }}
        >
          Отменить изменения
        </Button>
        <Button type="submit" disabled={!dirty || !warnValid || save.isPending}>
          {save.isPending ? 'Сохраняем…' : 'Сохранить'}
        </Button>
      </div>
    </form>
  )
}
