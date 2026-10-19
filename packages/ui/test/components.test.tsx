// @vitest-environment jsdom
import './setup-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import {
  Button,
  Checkbox,
  Chip,
  cn,
  Dialog,
  DialogContent,
  DialogTrigger,
  IconButton,
  icons,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  ProgressBar,
  SegmentedControl,
  Switch,
  TextField,
} from '../src'

describe('cn', () => {
  it('conoce los tokens propios de Muninn', () => {
    expect(cn('rounded-lg', 'rounded-dock')).toBe('rounded-dock')
    expect(cn('shadow-drag', 'shadow-popover')).toBe('shadow-popover')
    expect(cn('bg-surface', 'bg-accent')).toBe('bg-accent')
  })

  it('no confunde tamaño de texto con color de texto', () => {
    expect(cn('text-sm', 'text-fg-muted')).toBe('text-sm text-fg-muted')
    expect(cn('text-2xs', 'text-md')).toBe('text-md')
  })
})

describe('Button', () => {
  it('es type="button" por defecto (no envía formularios sin querer)', () => {
    render(<Button>Guardar</Button>)
    expect(screen.getByRole('button', { name: 'Guardar' })).toHaveAttribute('type', 'button')
  })

  it('asChild renderiza el enlace con estilo de botón', () => {
    render(
      <Button asChild variant="primary">
        <a href="/tablero">Abrir</a>
      </Button>,
    )
    const link = screen.getByRole('link', { name: 'Abrir' })
    expect(link).toHaveClass('bg-accent')
    expect(link).not.toHaveAttribute('type')
  })

  it('IconButton expone su aria-label', () => {
    render(<IconButton aria-label="Buscar" icon={<icons.search />} />)
    expect(screen.getByRole('button', { name: 'Buscar' })).toBeInTheDocument()
  })
})

describe('controles', () => {
  it('Switch alterna y comunica su estado', async () => {
    function Demo() {
      const [on, setOn] = useState(false)
      return <Switch aria-label="Cristal" checked={on} onCheckedChange={setOn} />
    }
    render(<Demo />)
    const sw = screen.getByRole('switch', { name: 'Cristal' })
    expect(sw).toHaveAttribute('aria-checked', 'false')
    await userEvent.click(sw)
    expect(sw).toHaveAttribute('aria-checked', 'true')
  })

  it('Checkbox llama a onCheckedChange', async () => {
    const onChange = vi.fn()
    render(<Checkbox aria-label="Completar" checked={false} onCheckedChange={onChange} />)
    await userEvent.click(screen.getByRole('checkbox', { name: 'Completar' }))
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('SegmentedControl nunca queda sin selección', async () => {
    const onChange = vi.fn()
    render(
      <SegmentedControl
        aria-label="Vista"
        value="board"
        onValueChange={onChange}
        options={[
          { value: 'board', label: 'Tablero' },
          { value: 'list', label: 'Lista' },
        ]}
      />,
    )
    await userEvent.click(screen.getByRole('radio', { name: 'Tablero' }))
    expect(onChange).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('radio', { name: 'Lista' }))
    expect(onChange).toHaveBeenCalledWith('list')
  })

  it('TextField asocia etiqueta, ayuda y error', () => {
    const { rerender } = render(<TextField label="Concepto" hint="Lo que verás en la lista" />)
    const input = screen.getByLabelText('Concepto')
    expect(input).toHaveAccessibleDescription('Lo que verás en la lista')
    rerender(<TextField label="Concepto" error="Obligatorio" />)
    expect(screen.getByLabelText('Concepto')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Concepto')).toHaveAccessibleDescription('Obligatorio')
  })
})

describe('display', () => {
  it('ProgressBar expone el porcentaje', () => {
    render(<ProgressBar label="Subtareas" value={0.6} />)
    expect(screen.getByRole('progressbar', { name: 'Subtareas' })).toHaveAttribute(
      'aria-valuenow',
      '60',
    )
  })

  it('Chip pinta el color del proyecto', () => {
    const { container } = render(<Chip dot="violet">HuginnDB</Chip>)
    const dot = container.querySelector<HTMLElement>('[aria-hidden="true"]')
    // jsdom normaliza #9C7CF4 a rgb().
    expect(dot?.style.background).toContain('rgb(156, 124, 244)')
  })
})

describe('overlays', () => {
  it('Dialog se abre, tiene nombre accesible y se cierra con Escape', async () => {
    render(
      <Dialog>
        <DialogTrigger asChild>
          <Button>Nuevo proyecto</Button>
        </DialogTrigger>
        <DialogContent title="Nuevo proyecto" description="Empieza con el tablero por defecto">
          <TextField label="Nombre" />
        </DialogContent>
      </Dialog>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Nuevo proyecto' }))
    expect(screen.getByRole('dialog', { name: 'Nuevo proyecto' })).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('Menu se abre con teclado y ejecuta la acción', async () => {
    const onArchive = vi.fn()
    render(
      <Menu>
        <MenuTrigger asChild>
          <IconButton aria-label="Más acciones" icon={<icons.dots />} />
        </MenuTrigger>
        <MenuContent>
          <MenuItem onSelect={onArchive} shortcut="E">
            Archivar
          </MenuItem>
        </MenuContent>
      </Menu>,
    )
    screen.getByRole('button', { name: 'Más acciones' }).focus()
    await userEvent.keyboard('{Enter}')
    await userEvent.click(screen.getByRole('menuitem', { name: /Archivar/ }))
    expect(onArchive).toHaveBeenCalled()
  })
})
