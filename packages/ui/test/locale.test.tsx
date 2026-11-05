// @vitest-environment jsdom
import './setup-dom'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  Calendar,
  DateField,
  Dialog,
  DialogContent,
  MonthCalendar,
  NotificationPill,
  SheetContent,
} from '../src'

/**
 * Sin `UiLocaleProvider`, los componentes salen en inglés (ADR-0077). Antes llevaban el español fijo («Hoy», «Cerrar»,
 * «Mes anterior», el selector de fecha entero) y se colaban con la app en inglés. Este test busca rastros de español en lo
 * que se lee y en lo que oye un lector de pantalla.
 */
const SPANISH =
  /[áéíóúñ¿¡]|\b(hoy|cerrar|quitar|sin fecha|este mes|anterior|siguiente|lunes|martes|jueves|viernes|sábado|domingo|enero|febrero|octubre|de 20\d\d)\b/i

function spanishIn(root: ParentNode): string[] {
  const found: string[] = []
  const check = (where: string, text: string | null | undefined) => {
    if (text && SPANISH.test(text)) found.push(`${where}: ${text}`)
  }
  check('texto', root.textContent)
  for (const el of root.querySelectorAll('[aria-label], [title], [placeholder]')) {
    check('aria-label', el.getAttribute('aria-label'))
    check('title', el.getAttribute('title'))
    check('placeholder', el.getAttribute('placeholder'))
  }
  return found
}

describe('@muninn/ui sin proveedor de idioma, en inglés', () => {
  it('calendario, selector de meses y campo de fecha', () => {
    const { container } = render(
      <>
        <Calendar value="2026-10-01" today="2026-10-27" onSelect={() => {}} onClear={() => {}} />
        <MonthCalendar value="2026-10" current="2026-10" onSelect={() => {}} />
        <DateField label="Due" value="" onChange={() => {}} />
        <DateField label="Due" value="2026-02-09" onChange={() => {}} />
      </>,
    )
    expect(spanishIn(container)).toEqual([])
  })

  it('diálogo, hoja y aviso de error', () => {
    const { baseElement } = render(
      <>
        <Dialog open>
          <DialogContent title="Title">Body</DialogContent>
        </Dialog>
        <Dialog open>
          <SheetContent title="Sheet">Body</SheetContent>
        </Dialog>
        <NotificationPill tone="error" title="Failed" onDismiss={() => {}} />
      </>,
    )
    expect(spanishIn(baseElement)).toEqual([])
  })
})
