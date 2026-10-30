import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { DOCK_TAB, type DockTab, parseDock, tabsFor } from '../shell/nav'
import { useEnabledModules } from './modules'
import { useMuninn } from './muninn'
import { settingsQuery } from './queries'

/**
 * Barra de abajo del teléfono (ADR-0072): de 1 a 4 pestañas elegidas por ti, en `user_settings.preferences.dock`. Te
 * sigue entre dispositivos, como la apariencia. En modo demo vive en la memoria de la demo. Lo que la cambia está en
 * `dock-actions.ts`, para que no viaje con el shell.
 */

/** La barra guardada, tal cual (sin quitar los módulos desactivados): la que se edita en Ajustes. */
export function useDock(): DockTab[] {
  const data = useQuery(settingsQuery(useMuninn())).data
  const raw = data?.preferences.dock
  return useMemo(() => parseDock(raw), [raw])
}

/** Las pestañas que se pintan: la barra guardada sin las de los módulos desactivados. */
export function useDockTabs(): DockTab[] {
  const dock = useDock()
  const modules = useEnabledModules()
  return useMemo(() => tabsFor(modules, dock), [modules, dock])
}

/** Etiqueta para los avisos. */
export const dockLabel = (id: DockTab) => DOCK_TAB[id].label
