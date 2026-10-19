import type { ModuleName } from '@muninn/core'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import type { EnabledModules } from '../shell/nav'
import { useMuninn } from './muninn'
import { settingsQuery } from './queries'

/** Orden de los módulos al guardarlos y al enseñarlos. */
export const MODULE_ORDER: ModuleName[] = ['tasks', 'notes', 'finance', 'github', 'news', 'focus']

/** La lista con ese módulo activado o desactivado, sin repetidos y en el orden de siempre. */
export function withModule(list: readonly ModuleName[], id: ModuleName, on: boolean): ModuleName[] {
  const set = new Set(list)
  if (on) set.add(id)
  else set.delete(id)
  return MODULE_ORDER.filter((m) => set.has(m))
}

/** Módulos activos del usuario. `null` mientras no se sepa (se trata como «todos»: ver `sectionEnabled`). */
export function useEnabledModules(): EnabledModules {
  const m = useMuninn()
  const modules = useQuery(settingsQuery(m)).data?.enabledModules
  return useMemo(() => (modules ? new Set(modules) : null), [modules])
}
