import type { IconProps } from '@phosphor-icons/react/dist/lib/types'
import type { ComponentType } from 'react'
import {
  ArrowCounterClockwise,
  ArrowUUpLeft,
  ArrowUUpRight,
  ChatCircleText,
  CheckCircle,
  CircleHalf,
  CodeBlock,
  Compass,
  Copy,
  Devices,
  FileText,
  Folder,
  FolderOpen,
  Key,
  ListBullets,
  ListChecks,
  ListNumbers,
  Plug,
  QrCode,
  Quotes,
  ShieldCheck,
  SquareHalfBottom,
  Sun,
  Table,
} from './screen-icons.generated'

/**
 * Iconos que solo usa alguna pantalla diferida. Van aparte de `icons` a propósito (con su propio fichero
 * generado, ADR-0058): todo lo de `icons` viaja en el arranque; esto solo viaja con su pantalla.
 * Si pasa a usarlo el shell, muévelo a `icons`.
 */
export const screenIcons = {
  list: ListBullets,
  checklist: ListChecks,
  // Documentación: iconos de guía y la marca «Parcial».
  compass: Compass,
  plug: Plug,
  shield: ShieldCheck,
  partial: CircleHalf,
  // Ajustes: informe de la mañana y «Restablecer».
  sun: Sun,
  reset: ArrowCounterClockwise,
  // Ajustes › Cuenta: sesiones y segundo factor (ADR-0061).
  devices: Devices,
  key: Key,
  copy: Copy,
  qr: QrCode,
  dock: SquareHalfBottom,
  // Notas en árbol (ADR-0083): página y carpeta.
  page: FileText,
  folder: Folder,
  folderOpen: FolderOpen,
  // Editor de notas en sitio (ADR-0078) y comentarios (ADR-0079).
  listNumbers: ListNumbers,
  quote: Quotes,
  codeBlock: CodeBlock,
  table: Table,
  undo: ArrowUUpLeft,
  redo: ArrowUUpRight,
  comment: ChatCircleText,
  resolve: CheckCircle,
} satisfies Record<string, ComponentType<IconProps>>

export type ScreenIconName = keyof typeof screenIcons
