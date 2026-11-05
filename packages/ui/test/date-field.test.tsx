// @vitest-environment jsdom
import './setup-dom'
import { render as rtlRender, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { type ReactElement, type ReactNode, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import {
  Calendar,
  DateField,
  formatDateShort,
  MonthCalendar,
  type UiLocale,
  UiLocaleProvider,
} from '../src'

/** Lo que pone la app en español (los textos de verdad salen de sus `locales`). */
const ES: UiLocale = {
  locale: 'es-ES',
  labels: {
    today: 'Hoy',
    clearDate: 'Quitar fecha',
    thisMonth: 'Este mes',
    noDate: 'Sin fecha',
    prevMonth: 'Mes anterior',
    nextMonth: 'Mes siguiente',
    prevYear: 'Año anterior',
    nextYear: 'Año siguiente',
    close: 'Cerrar',
    closeNotification: 'Cerrar notificación',
    monthOfYear: (month, year) => `${month} de ${year}`,
  },
}
const Spanish = ({ children }: { children: ReactNode }) => (
  <UiLocaleProvider value={ES}>{children}</UiLocaleProvider>
)
const render = (ui: ReactElement) => rtlRender(ui, { wrapper: Spanish })

describe('Calendar', () => {
  it('empieza la semana en lunes y marca hoy y el día elegido', () => {
    render(<Calendar value="2026-10-01" today="2026-10-27" onSelect={() => {}} />)
    expect(screen.getByText('Octubre de 2026')).toBeInTheDocument()
    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent)
    expect(headers).toEqual(['L', 'M', 'X', 'J', 'V', 'S', 'D'])
    // Octubre de 2026 empieza en jueves: la primera fila trae del 28 de septiembre al 4 de octubre.
    expect(screen.getAllByRole('row')[1]?.textContent).toBe('2829301234')
    expect(screen.getByRole('button', { name: 'jueves, 1 de octubre de 2026' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'martes, 27 de octubre de 2026' })).toHaveAttribute(
      'aria-current',
      'date',
    )
  })

  it('se maneja con el teclado: flechas, semanas y meses', async () => {
    const onSelect = vi.fn()
    render(<Calendar value="2026-01-31" today="2026-10-27" onSelect={onSelect} autoFocus />)
    expect(screen.getByRole('button', { name: /31 de enero/ })).toHaveFocus()
    // RePág/AvPág no se pasan del último día del mes: 31 de enero → 28 de febrero.
    await userEvent.keyboard('{PageDown}')
    expect(screen.getByText('Febrero de 2026')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /28 de febrero/ })).toHaveFocus()
    await userEvent.keyboard('{ArrowRight}{ArrowUp}{Enter}')
    expect(onSelect).toHaveBeenCalledWith('2026-02-22')
  })

  it('«Hoy» elige hoy y «Quitar fecha» solo aparece si hay fecha', async () => {
    const onSelect = vi.fn()
    const onClear = vi.fn()
    const { rerender } = render(
      <Calendar value="" today="2026-10-27" onSelect={onSelect} onClear={onClear} />,
    )
    expect(screen.queryByRole('button', { name: 'Quitar fecha' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Hoy' }))
    expect(onSelect).toHaveBeenCalledWith('2026-10-27')
    rerender(
      <Calendar value="2026-10-03" today="2026-10-27" onSelect={onSelect} onClear={onClear} />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Quitar fecha' }))
    expect(onClear).toHaveBeenCalled()
  })
})

describe('DateField', () => {
  it('con ratón abre el calendario, elige y se cierra', async () => {
    function Harness() {
      const [v, setV] = useState('2026-10-27')
      return <DateField label="Fecha" value={v} onChange={setV} today="2026-10-27" />
    }
    render(<Harness />)
    const field = screen.getByRole('button', { name: 'Fecha' })
    expect(field).toHaveTextContent('Mar, 27 oct 2026')
    await userEvent.click(field)
    await userEvent.click(screen.getByRole('button', { name: 'jueves, 1 de octubre de 2026' }))
    expect(screen.queryByRole('table')).toBeNull()
    expect(field).toHaveTextContent('Jue, 1 oct 2026')
  })
})

it('formatDateShort da una fecha corta en el idioma pedido, sin puntos (inglés por defecto)', () => {
  expect(formatDateShort('2026-02-09', 'es-ES')).toBe('lun, 9 feb 2026')
  expect(formatDateShort('2026-02-09')).toBe('Mon, 9 Feb 2026')
})

describe('MonthCalendar', () => {
  it('enseña los meses del año, marca el actual y el elegido, y cambia de año', async () => {
    const onSelect = vi.fn()
    render(<MonthCalendar value="2026-10" current="2026-10" onSelect={onSelect} autoFocus />)
    expect(screen.getByText('2026')).toBeInTheDocument()
    const oct = screen.getByRole('button', { name: 'Octubre de 2026' })
    expect(oct).toHaveFocus()
    expect(oct).toHaveAttribute('aria-pressed', 'true')
    expect(oct).toHaveAttribute('aria-current', 'date')
    await userEvent.click(screen.getByRole('button', { name: 'Año anterior' }))
    expect(screen.getByText('2025')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Septiembre de 2025' }))
    expect(onSelect).toHaveBeenLastCalledWith('2025-09')
  })

  it('con el teclado: flechas por mes y trimestre, RePág por año', async () => {
    const onSelect = vi.fn()
    render(<MonthCalendar value="2026-01" current="2026-10" onSelect={onSelect} autoFocus />)
    // Enero − 1 mes = diciembre del año anterior; − 3 = septiembre; − 1 año = septiembre de 2024.
    await userEvent.keyboard('{ArrowLeft}{ArrowUp}{PageUp}{Enter}')
    expect(onSelect).toHaveBeenLastCalledWith('2024-09')
    await userEvent.click(screen.getByRole('button', { name: 'Este mes' }))
    expect(onSelect).toHaveBeenLastCalledWith('2026-10')
  })
})

describe('sin proveedor, en inglés (ADR-0077)', () => {
  it('el calendario, sus días y sus botones', () => {
    rtlRender(
      <Calendar value="2026-10-01" today="2026-10-27" onSelect={() => {}} onClear={() => {}} />,
    )
    expect(screen.getByText('October 2026')).toBeInTheDocument()
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'M',
      'T',
      'W',
      'T',
      'F',
      'S',
      'S',
    ])
    expect(screen.getByRole('button', { name: 'Previous month' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Today' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Clear date' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Thursday, 1 October 2026' })).toBeInTheDocument()
  })

  it('el selector de meses y el campo vacío', () => {
    rtlRender(<MonthCalendar value="2026-10" current="2026-10" onSelect={() => {}} />)
    expect(screen.getByRole('button', { name: 'Previous year' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'October 2026' })).toHaveTextContent('Oct')
    expect(screen.getByRole('button', { name: 'This month' })).toBeInTheDocument()
  })
})
