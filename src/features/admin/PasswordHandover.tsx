import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button, Field, Input } from '@/shared/ui'

/**
 * A one-time password for the administrator to pass on, with the e-mail it
 * signs in with. Shown once: the server keeps only its hash.
 */
export function PasswordHandover({ email, password }: { email: string; password: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${email}\n${password}`)
      setCopied(true)
    } catch {
      // No clipboard (an old browser, a blocked permission): the fields below select on focus.
    }
  }
  return (
    <div className="grid gap-4">
      <Field label="Почта для входа">
        {(id) => <Input id={id} readOnly value={email} onFocus={(e) => e.target.select()} />}
      </Field>
      <Field
        label="Пароль для первого входа"
        hint="Показан один раз. Потерялся — сбросьте пароль, и кабинет выдаст новый."
      >
        {(id) => (
          <Input
            id={id}
            readOnly
            value={password}
            onFocus={(e) => e.target.select()}
            className="font-medium tracking-wider tabular"
          />
        )}
      </Field>
      <Button
        variant="secondary"
        size="sm"
        icon={copied ? Check : Copy}
        onClick={() => void copy()}
        className="justify-self-start"
      >
        {copied ? 'Скопировано' : 'Скопировать почту и пароль'}
      </Button>
    </div>
  )
}
