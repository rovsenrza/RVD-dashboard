import { useState, type FormEvent } from 'react'
import type { CabinetSettings } from '@/entities/types'
import { WARN_DAYS_RANGE, WARN_PERCENT_RANGE, warnRuleLabel } from '@/entities/product'
import { useSaveSettings, useSettings } from '@/shared/api/queries'
import {
  Button,
  Card,
  Checkbox,
  Field,
  Input,
  QueryState,
  SegmentedControl,
  Skeleton,
  useToast,
} from '@/shared/ui'

const LEAD_OPTIONS = [60, 30, 14, 7, 3, 1]

type WarnRule = CabinetSettings['warnRule']
const RULES: { value: WarnRule; label: string }[] = [
  { value: 'percent', label: 'Доля срока' },
  { value: 'days', label: 'Дни до замены' },
]
/** Per rule: allowed range, unit, and the wording under the field. */
const RULE_FIELD = {
  percent: {
    range: WARN_PERCENT_RANGE,
    unit: '%',
    maxLength: 2,
    label: 'Последние, % срока эксплуатации',
  },
  days: {
    range: WARN_DAYS_RANGE,
    unit: 'дн.',
    maxLength: 3,
    label: 'Последние, дней до плановой замены',
  },
} as const

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
  const [rule, setRule] = useState(saved.warnRule)
  const [percent, setPercent] = useState(String(saved.warnPercent))
  const [days, setDays] = useState(String(saved.warnDays))
  const [leadDays, setLeadDays] = useState(saved.leadDays)
  const [email, setEmail] = useState(saved.channels.email)

  const field = RULE_FIELD[rule]
  const [warn, setWarn] = rule === 'percent' ? [percent, setPercent] : [days, setDays]
  const [min, max] = field.range
  const warnValid = /^\d+$/.test(warn) && Number(warn) >= min && Number(warn) <= max
  // The unused rule keeps its saved value, so switching back and forth is not a change.
  const next: CabinetSettings = {
    warnRule: rule,
    warnPercent: rule === 'percent' ? Number(percent) : saved.warnPercent,
    warnDays: rule === 'days' ? Number(days) : saved.warnDays,
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
          warnRuleLabel(next) !== warnRuleLabel(saved)
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
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <span className="text-ui font-medium">«Внимание» — считать как</span>
              <SegmentedControl
                label="Правило «Внимание»"
                value={rule}
                options={RULES}
                onChange={setRule}
                className="justify-self-start"
              />
            </div>
            <Field
              label={field.label}
              hint={`Сейчас: ${warnRuleLabel(saved)}. От ${min} до ${max}. Отсчёт — от установки, без неё — от отгрузки. Статусы пересчитываются сразу после сохранения.`}
              error={warn && !warnValid ? `Введите целое число от ${min} до ${max}` : undefined}
            >
              {(id) => (
                <div className="flex items-center gap-2">
                  <Input
                    id={id}
                    inputMode="numeric"
                    value={warn}
                    required
                    aria-invalid={!warnValid || undefined}
                    onChange={(e) =>
                      setWarn(e.target.value.replace(/\D/g, '').slice(0, field.maxLength))
                    }
                    className="w-24 tabular"
                  />
                  <span className="text-ink-muted">{field.unit}</span>
                </div>
              )}
            </Field>
          </div>
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
            setRule(saved.warnRule)
            setPercent(String(saved.warnPercent))
            setDays(String(saved.warnDays))
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
