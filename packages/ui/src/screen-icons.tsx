import type { IconProps } from '@phosphor-icons/react/dist/lib/types'
import type { ComponentType } from 'react'
import {
  ArrowCounterClockwise,
  CircleHalf,
  Compass,
  Copy,
  Devices,
  Key,
  ListBullets,
  ListChecks,
  Plug,
  QrCode,
  ShieldCheck,
  SquareHalfBottom,
  Sun,
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
} satisfies Record<string, ComponentType<IconProps>>

export type ScreenIconName = keyof typeof screenIcons
