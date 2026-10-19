import { type IconProps, ListBullets, ListChecks } from '@phosphor-icons/react'
import type { ComponentType } from 'react'

/**
 * Iconos que solo usa alguna pantalla diferida. Van aparte de `icons` a propósito: cada icono de Phosphor trae
 * sus seis grosores (~3 kB) y todo lo de `icons` viaja en el arranque; esto solo viaja con su pantalla.
 * Si pasa a usarlo el shell, muévelo a `icons`.
 */
export const screenIcons = {
  list: ListBullets,
  checklist: ListChecks,
} satisfies Record<string, ComponentType<IconProps>>
