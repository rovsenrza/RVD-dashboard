import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { DatePicker } from './DatePicker'

function Harness({
  initial = '',
  min,
  max,
  onChange,
}: {
  initial?: string
  min?: string
  max?: string
  onChange: (iso: string) => void
}) {
  const [value, setValue] = useState(initial)
  return (
    <DatePicker
      value={value}
      min={min}
      max={max}
      onChange={(iso) => {
        setValue(iso)
        onChange(iso)
      }}
    />
  )
}

const field = () => screen.getByPlaceholderText('дд.мм.гггг') as HTMLInputElement
const type = (text: string) => fireEvent.change(field(), { target: { value: text } })

describe('DatePicker', () => {
  it('shows an ISO value as dd.MM.yyyy', () => {
    render(<Harness initial="2026-07-12" onChange={() => {}} />)
    expect(field().value).toBe('12.07.2026')
  })

  it('inserts the dots and emits ISO once the date is complete', () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    type('2509')
    expect(field().value).toBe('25.09')
    expect(onChange).not.toHaveBeenCalled()
    type('25092026')
    expect(field().value).toBe('25.09.2026')
    expect(onChange).toHaveBeenLastCalledWith('2026-09-25')
  })

  it('accepts a pasted ISO date', () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    type('2026-02-03')
    expect(field().value).toBe('03.02.2026')
    expect(onChange).toHaveBeenLastCalledWith('2026-02-03')
  })

  it('rejects impossible and out-of-range dates through form validation', () => {
    const onChange = vi.fn()
    render(<Harness max="2026-09-22" onChange={onChange} />)
    type('31.02.2026')
    expect(onChange).not.toHaveBeenCalled()
    expect(field().validationMessage).toBe('Введите дату в формате дд.мм.гггг')
    type('01.10.2026')
    expect(onChange).not.toHaveBeenCalled()
    expect(field().validationMessage).toBe('Дата не может быть позже 22.09.2026')
    type('21.09.2026')
    expect(onChange).toHaveBeenLastCalledWith('2026-09-21')
    expect(field().validity.valid).toBe(true)
  })

  it('marks an unfinished date invalid only after the field is left', () => {
    render(<Harness onChange={() => {}} />)
    type('12.07')
    expect(field()).not.toHaveAttribute('aria-invalid')
    fireEvent.blur(field())
    expect(field()).toHaveAttribute('aria-invalid', 'true')
    type('12.07.2026')
    expect(field()).not.toHaveAttribute('aria-invalid')
  })

  it('emits an empty string when cleared', () => {
    const onChange = vi.fn()
    render(<Harness initial="2026-07-12" onChange={onChange} />)
    type('')
    expect(onChange).toHaveBeenLastCalledWith('')
  })
})
