import { useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from './DataTable'
import { DescriptionList } from './DescriptionList'

interface Row {
  n: number
}
const rows: Row[] = Array.from({ length: 100 }, (_, i) => ({ n: i + 1 }))
const columns: ColumnDef<Row, unknown>[] = [{ accessorKey: 'n', header: '№' }]

const jump = (page: string) => {
  const field = screen.getByLabelText('Перейти на страницу, всего 10')
  fireEvent.change(field, { target: { value: page } })
  fireEvent.keyDown(field, { key: 'Enter' })
}

describe('DataTable page jump', () => {
  it('goes straight to the typed page', () => {
    render(<DataTable data={rows} columns={columns} pageSize={10} />)
    jump('7')
    expect(screen.getByText(/Показано 61–70 из 100/)).toBeInTheDocument()
  })

  it('lands on the last or first page when the number is out of range', () => {
    render(<DataTable data={rows} columns={columns} pageSize={10} />)
    jump('999')
    expect(screen.getByText(/Показано 91–100 из 100/)).toBeInTheDocument()
    jump('0')
    expect(screen.getByText(/Показано 1–10 из 100/)).toBeInTheDocument()
  })

  it('is not offered for a short table', () => {
    render(<DataTable data={rows.slice(0, 30)} columns={columns} pageSize={10} />)
    expect(screen.queryByLabelText(/Перейти на страницу/)).not.toBeInTheDocument()
  })
})

describe('DataTable phone rows', () => {
  interface Hose {
    ehs: string
    place: string
    maker: string
    status: string
  }
  const hoseColumns: ColumnDef<Hose, unknown>[] = [
    { accessorKey: 'ehs', header: 'EHS №' },
    { accessorKey: 'place', header: 'Место' },
    { accessorKey: 'maker', header: 'Производитель', meta: { mobile: 'hide' } },
    { accessorKey: 'status', header: 'Статус', meta: { mobile: 'aside' } },
  ]

  it('leads with the key, sets the status beside it and lists the rest', () => {
    const onRowClick = vi.fn()
    render(
      <DataTable
        data={[{ ehs: '48703', place: 'Ковш', maker: 'Rock', status: 'Норма' }]}
        columns={hoseColumns}
        onRowClick={onRowClick}
      />,
    )
    const card = screen.getByRole('link')
    expect(within(card).getByText('48703')).toBeInTheDocument()
    expect(within(card).getByText('Норма')).toBeInTheDocument()
    expect(within(card).getByText('Место').tagName).toBe('DT')
    expect(within(card).queryByText('Статус')).toBeNull()
    expect(within(card).queryByText('Rock')).toBeNull()
    fireEvent.keyDown(card, { key: 'Enter' })
    expect(onRowClick).toHaveBeenCalledWith(expect.objectContaining({ ehs: '48703' }))
  })
})

describe('DataTable with filters', () => {
  it('keeps the toolbar when the filtered data is empty, so the filter can be undone', () => {
    render(<DataTable data={[]} columns={columns} toolbar={<span>Фильтр</span>} />)
    expect(screen.getByText('Фильтр')).toBeInTheDocument()
    expect(screen.getAllByText('По запросу ничего не найдено').length).toBeGreaterThan(0)
    expect(screen.queryByText(/Показано/)).toBeNull()
  })
})

describe('DescriptionList', () => {
  it('pairs terms with values and renders missing values as the empty dash', () => {
    render(
      <DescriptionList
        items={[
          ['Гаражный №', 'НТ04'],
          ['Инвентарный №', null],
        ]}
      />,
    )
    expect(screen.getByText('Гаражный №').tagName).toBe('DT')
    expect(screen.getByText('НТ04').tagName).toBe('DD')
    expect(screen.getByText('Инвентарный №').nextElementSibling?.textContent).toBe('—')
  })
})

describe('DataTable selection', () => {
  interface Hose {
    id: string
    ehs: string
    made: boolean
  }
  const hoses: Hose[] = Array.from({ length: 12 }, (_, i) => ({
    id: `h${i + 1}`,
    ehs: String(48700 + i),
    made: i !== 2,
  }))
  const hoseColumns: ColumnDef<Hose, unknown>[] = [{ accessorKey: 'ehs', header: 'EHS №' }]

  function Picking({ onRowClick = () => {} }: { onRowClick?: (h: Hose) => void }) {
    const [picked, setPicked] = useState<Set<string>>(() => new Set())
    return (
      <>
        <output data-testid="picked">{[...picked].sort().join(',')}</output>
        <DataTable
          data={hoses}
          columns={hoseColumns}
          pageSize={5}
          onRowClick={onRowClick}
          selection={{
            rowId: (h) => h.id,
            selected: picked,
            onChange: setPicked,
            canSelect: (h) => h.made,
            label: (h) => `Выбрать EHS ${h.ehs}`,
          }}
        />
      </>
    )
  }
  const picked = () => screen.getByTestId('picked').textContent

  it('ticks a row without opening it', () => {
    const onRowClick = vi.fn()
    render(<Picking onRowClick={onRowClick} />)
    // Phones and desktop both render the row; the first box is the phone card's.
    fireEvent.click(screen.getAllByLabelText('Выбрать EHS 48701')[0])
    expect(picked()).toBe('h2')
    expect(onRowClick).not.toHaveBeenCalled()
  })

  it('ticks every selectable row on the page from the header, and clears them again', () => {
    render(<Picking />)
    const all = screen.getByLabelText('Выбрать все на странице')
    fireEvent.click(all)
    // Five rows on the page, one of them still being made: four ticked.
    expect(picked()).toBe('h1,h2,h4,h5')
    fireEvent.click(all)
    expect(picked()).toBe('')
  })

  it('offers no box for a row that cannot be selected, and marks a partial page', () => {
    render(<Picking />)
    expect(screen.queryAllByLabelText('Выбрать EHS 48702')).toHaveLength(0)
    fireEvent.click(screen.getAllByLabelText('Выбрать EHS 48700')[0])
    expect(
      (screen.getByLabelText('Выбрать все на странице') as HTMLInputElement).indeterminate,
    ).toBe(true)
  })
})
