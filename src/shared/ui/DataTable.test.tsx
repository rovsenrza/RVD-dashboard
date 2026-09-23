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
