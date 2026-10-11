import { useState, type FormEvent } from 'react'
import type { CabinetSettings } from '@/entities/types'
import { INSPECTION_DAY_OPTIONS, INSPECTION_LABEL, LEAD_DAY_OPTIONS } from '@/entities/settings'
import { useSaveSettings, useSettings } from '@/shared/api/queries'
import { Button, Card, Checkbox, Field, QueryState, Select, Skeleton, useToast } from '@/shared/ui'

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
  const [leadDays, setLeadDays] = useState(saved.leadDays)
  const [email, setEmail] = useState(saved.channels.email)
  const [inspection, setInspection] = useState(saved.inspectionDays)

  // The «Внимание» setting is no longer read (the warranty lays out the life); it is kept as saved.
  const next: CabinetSettings = {
    ...saved,
    leadDays: [...leadDays].sort((a, b) => b - a),
    channels: { inApp: true, email },
    inspectionDays: inspection,
  }
  const dirty = JSON.stringify(next) !== JSON.stringify(saved)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    save.mutate(next, {
      onSuccess: () => toast('Настройки сохранены'),
      onError: () => toast('Не удалось сохранить настройки', 'error'),
    })
  }

  return (
    <form onSubmit={submit} className="grid gap-5">
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Card title="Состояние ресурса">
          <p className="text-ui text-ink-muted">
            Срок изделия раскладывается по его гарантии: первая половина — в порядке, следующая
            четверть — «Внимание», последняя — «Пора менять». После конца гарантии шкала идёт ещё
            столько же, сколько красная зона, и останавливается. Отсчёт — от установки, без неё — от
            отгрузки.
          </p>
        </Card>

        <Card title="Уведомления">
          <fieldset className="grid gap-2.5">
            <legend className="mb-1.5 text-ui font-medium">
              Предупреждать о конце гарантии, плановой замене и перепробеге
            </legend>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {LEAD_DAY_OPTIONS.map((d) => (
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
          <div className="mt-5 border-t border-line pt-4">
            <Field
              label="Плановый осмотр рукавов на технике"
              hint="Напоминание по каждой машине — от её первого рукава в работе"
            >
              {(id) => (
                <Select
                  id={id}
                  value={String(inspection)}
                  options={INSPECTION_DAY_OPTIONS.map((d) => ({
                    value: String(d),
                    label: INSPECTION_LABEL[d],
                  }))}
                  onChange={(e) => setInspection(Number(e.target.value))}
                  className="sm:w-60"
                />
              )}
            </Field>
          </div>
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
            setLeadDays(saved.leadDays)
            setEmail(saved.channels.email)
            setInspection(saved.inspectionDays)
          }}
        >
          Отменить изменения
        </Button>
        <Button type="submit" disabled={!dirty || save.isPending}>
          {save.isPending ? 'Сохраняем…' : 'Сохранить'}
        </Button>
      </div>
    </form>
  )
}
