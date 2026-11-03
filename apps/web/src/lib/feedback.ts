import { type NotifyOptions, notify } from '@muninn/ui'
import { t } from '../i18n'

/**
 * Feedback de las acciones (CLAUDE.md: toda acción avisa; lo que cambia datos ofrece «Deshacer», ADR-0019 y ADR-0025).
 * Sin dependencias de react-query ni del core: lo usan todas las acciones, también las de `queries.ts`.
 */

/** Errores de supabase-js al llamar a una Edge Function: llegan en inglés y sin nada útil para quien usa la app. */
const EDGE_ERRORS = {
  FunctionsFetchError: 'feedback.serverUnreachable',
  FunctionsRelayError: 'feedback.serverUnreachable',
  FunctionsHttpError: 'feedback.serverError',
} as const

export const reason = (err: unknown) =>
  typeof navigator !== 'undefined' && navigator.onLine === false
    ? t('feedback.offline')
    : err instanceof Error
      ? err.name in EDGE_ERRORS
        ? t(EDGE_ERRORS[err.name as keyof typeof EDGE_ERRORS])
        : err.message
      : undefined

export const fail = (title: string, err: unknown) =>
  notify.error(title, { description: reason(err) })

export interface UndoOptions extends Omit<NotifyOptions, 'action'> {
  /**
   * La inversa del cambio (puede ser síncrona). Si devuelve `false`, ya avisó ella del fallo (las acciones que se
   * llaman a sí mismas con `{ undoing: true }`) y no se dice nada más; si lanza, se avisa con `failTitle`. `null`:
   * esta vez no hay inversa (no se sabe a dónde volver) y el aviso sale sin «Deshacer».
   */
  undo: (() => unknown) | null
  /** Aviso tras deshacer: un título, o título y opciones. Por defecto, «Cambio deshecho» en el idioma activo. */
  undone?: string | [string, NotifyOptions]
  failTitle?: string
}

/**
 * Aviso de éxito con «Deshacer»: cada acción es un comando con su inversa. Concentra lo que antes se copiaba en cada
 * acción, incluido el aviso si deshacer falla (sin él, el error se perdía en la consola).
 */
export function notifyUndo(title: string, { undo, undone, failTitle, ...opts }: UndoOptions) {
  if (!undo) {
    notify.success(title, opts)
    return
  }
  notify.success(title, {
    ...opts,
    action: {
      label: t('feedback.undo'),
      onClick: async () => {
        try {
          if ((await undo()) === false) return
        } catch (err) {
          fail(failTitle ?? t('feedback.undoFailed'), err)
          return
        }
        const done = undone ?? t('feedback.undone')
        const [doneTitle, doneOpts] = typeof done === 'string' ? [done, undefined] : done
        notify.info(doneTitle, doneOpts)
      },
    },
  })
}
