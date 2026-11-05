import { notify } from '@muninn/ui'
import { useSyncExternalStore } from 'react'
import { applyLocalePref, currentLocale, t } from '../i18n'
import {
  LOCALE_KEY,
  type LocalePref,
  readLocalePref,
  toLocalePref,
  writeLocalePref,
} from '../i18n/locale'
import { notifyUndo } from './feedback'

/**
 * La preferencia de idioma (ADR-0077), como la apariencia (`appearance.ts`): con sesión manda la cuenta
 * (`preferences.locale`) y localStorage es la caché del primer pintado; en modo demo, solo la copia local.
 */
let pref: LocalePref = readLocalePref()
const listeners = new Set<() => void>()
const emit = () => {
  for (const l of listeners) l()
}

/** Cambia la preferencia, la guarda en el dispositivo y cambia el idioma. Devuelve la anterior. */
export function setLocalePref(next: LocalePref): LocalePref {
  const prev = pref
  pref = next
  writeLocalePref(next)
  void applyLocalePref(next)
  emit()
  return prev
}

export function useLocalePref(): LocalePref {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => pref,
  )
}

if (typeof window !== 'undefined') {
  // Otra pestaña cambió el idioma: lo seguimos sin volver a guardar.
  window.addEventListener('storage', (e) => {
    if (e.key !== LOCALE_KEY) return
    pref = readLocalePref()
    void applyLocalePref(pref)
    emit()
  })
}

export type LocaleRemote = (pref: LocalePref) => Promise<unknown>
let remote: LocaleRemote | null = null

/**
 * Conecta el idioma con la cuenta al iniciar sesión (`null` en modo demo). Si la cuenta tiene uno guardado, gana; si no,
 * se sube el de este dispositivo.
 */
export function connectLocale(save: LocaleRemote | null, saved?: unknown) {
  remote = save
  if (!save) return
  if (saved === undefined || saved === null) {
    save(pref).catch(() => {})
    return
  }
  const next = toLocalePref(saved)
  if (next !== pref) setLocalePref(next)
}

function saveRemote(next: LocalePref) {
  remote?.(next).catch(() => {
    notify.error(t('language.saveFailed'), { description: t('language.saveFailedHint') })
  })
}

/** Guarda el idioma en el dispositivo y en la cuenta, sin aviso (lo usa «Restablecer»). */
export function storeLocalePref(next: LocalePref): LocalePref {
  const prev = setLocalePref(next)
  saveRemote(next)
  return prev
}

/** Cambia el idioma con feedback y «Deshacer» (ADR-0019). El aviso ya sale en el idioma nuevo. */
export async function changeLocale(next: LocalePref) {
  const prev = storeLocalePref(next)
  await applyLocalePref(next)
  notifyUndo(t('language.changed', { language: t(`language.${currentLocale()}`) }), {
    icon: 'globe',
    description: remote ? t('language.savedToAccount') : t('language.savedHere'),
    // Avisa ella, ya en el idioma al que se vuelve (`undone` se escribiría en el de ahora).
    undo: async () => {
      storeLocalePref(prev)
      await applyLocalePref(prev)
      notify.info(t('language.restored'), { icon: 'globe' })
      return false
    },
  })
}
