import { type IconName, type IconProps, icons, type ScreenIconName, screenIcons } from '@muninn/ui'
import type { ComponentType } from 'react'

/**
 * Icono por nombre de `icons` o de `screenIcons`, para pantallas diferidas que lo leen de datos (guías,
 * secciones de Ajustes). Solo para esas pantallas: importa `screenIcons` entero.
 */
export type AppIconName = IconName | ScreenIconName

const ALL: Record<string, ComponentType<IconProps>> = { ...icons, ...screenIcons }

export const isAppIcon = (name: string): name is AppIconName => name in ALL

/** El icono con ese nombre; si no existe, el del libro. */
export function AppIcon({ name, ...props }: IconProps & { name: string }) {
  const Component = ALL[name] ?? icons.docs
  return <Component aria-hidden={props['aria-label'] ? undefined : true} {...props} />
}
