import type { BoardColumn, ColumnKind } from '@muninn/core'
import {
  Button,
  columnKinds,
  Dialog,
  DialogClose,
  DialogContent,
  type PaletteColor,
  palette,
  TextField,
} from '@muninn/ui'
import { useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SelectMenu } from '../../components/SelectMenu'
import { type Swatch, SwatchPicker } from '../../components/SwatchPicker'
import { t } from '../../i18n'
import { KIND_LABEL } from '../../lib/board'
import { createColumn, updateColumn } from '../../lib/column-actions'
import { useMuninn } from '../../lib/muninn'

/** Tipos de columna, con la etiqueta en el idioma activo: se piden al pintar (ADR-0077). */
const kindOptions = () =>
  (Object.keys(KIND_LABEL) as ColumnKind[]).map((k) => ({
    value: k,
    label: KIND_LABEL[k],
    dot: columnKinds[k],
  }))

/** «Automático» = sin color propio (`null`): el punto usa el del tipo. */
type ColumnColor = 'auto' | PaletteColor

/** Colores propios de la paleta, en su orden. La etiqueta se lee al pintar, en el idioma activo. */
const COLORS: readonly PaletteColor[] = ['blue', 'violet', 'teal', 'pink', 'green', 'amber', 'gray']

const colorOptions = (kind: ColumnKind): Swatch<ColumnColor>[] => [
  { value: 'auto', label: t('columnDialog.colorAuto', { ns: 'board' }), color: columnKinds[kind] },
  ...COLORS.map((c) => ({
    value: c,
    label: t(`columnDialog.colors.${c}`, { ns: 'board' }),
    color: palette[c],
  })),
]

const asColor = (c: string | null | undefined): ColumnColor =>
  c && (COLORS as readonly string[]).includes(c) ? (c as PaletteColor) : 'auto'

interface ColumnDialogProps {
  projectId: string
  /** `null` = cerrado; `'new'` = crear; una columna = editarla. */
  target: BoardColumn | 'new' | null
  onClose: () => void
}

/** Crear o editar una columna: nombre, tipo (qué significa «hecho»), color y límite de trabajo en curso. */
export function ColumnDialog({ projectId, target, onClose }: ColumnDialogProps) {
  const m = useMuninn()
  const qc = useQueryClient()
  const { t } = useTranslation('board')
  const editing = target && target !== 'new' ? target : null
  const [name, setName] = useState('')
  const [kind, setKind] = useState<ColumnKind>('todo')
  const [wip, setWip] = useState('')
  const [color, setColor] = useState<ColumnColor>('auto')
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)

  // Cada vez que se abre, parte de los valores de la columna (o de los de una nueva).
  useEffect(() => {
    if (!target) return
    setName(editing?.name ?? '')
    setKind(editing?.kind ?? 'todo')
    setWip(editing?.wipLimit ? String(editing.wipLimit) : '')
    setColor(asColor(editing?.color))
    setError(undefined)
  }, [target, editing])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const clean = name.trim()
    if (!clean) return setError(t('columnDialog.nameRequired'))
    const limit = wip.trim() === '' ? null : Number(wip)
    if (limit !== null && (!Number.isInteger(limit) || limit < 1)) {
      return setError(t('columnDialog.limitInvalid'))
    }
    const newColor = color === 'auto' ? null : color
    setSaving(true)
    if (editing) {
      const patch = {
        ...(clean !== editing.name ? { name: clean } : {}),
        ...(kind !== editing.kind ? { kind } : {}),
        ...(limit !== editing.wipLimit ? { wipLimit: limit } : {}),
        ...(newColor !== (editing.color ?? null) ? { color: newColor } : {}),
      }
      const renamedOnly = Object.keys(patch).length === 1 && 'name' in patch
      const ok =
        Object.keys(patch).length === 0 ||
        (await updateColumn(
          m,
          qc,
          editing,
          patch,
          renamedOnly
            ? t('columnDialog.renamed', { name: clean })
            : t('columnDialog.updated', { name: clean }),
        ))
      setSaving(false)
      if (ok) onClose()
    } else {
      const column = await createColumn(m, qc, {
        projectId,
        name: clean,
        kind,
        wipLimit: limit,
        color: newColor,
      })
      setSaving(false)
      if (column) onClose()
    }
  }

  return (
    <Dialog open={target !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title={editing ? t('columnDialog.editTitle') : t('header.newColumn')}
        description={t('columnDialog.description')}
      >
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <TextField
            label={t('columnDialog.name')}
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setError(undefined)
            }}
            maxLength={60}
            autoComplete="off"
            autoFocus
          />
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-fg-muted">{t('columnDialog.kind')}</span>
            <SelectMenu
              label={t('columnDialog.kind')}
              value={kind}
              options={kindOptions()}
              onChange={setKind}
            />
          </div>
          <SwatchPicker
            legend={t('columnDialog.color')}
            name="column-color"
            value={color}
            options={colorOptions(kind)}
            onChange={setColor}
          />
          <TextField
            label={t('columnDialog.limit')}
            hint={t('columnDialog.limitHint')}
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={wip}
            onChange={(e) => {
              setWip(e.target.value)
              setError(undefined)
            }}
            error={error}
          />
          <div className="flex justify-end gap-2 pt-1">
            <DialogClose asChild>
              <Button variant="ghost">{t('cancel')}</Button>
            </DialogClose>
            <Button type="submit" variant="primary" disabled={saving}>
              {editing ? t('save') : t('columnDialog.create')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
