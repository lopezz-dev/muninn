import { type NotifyOptions, notify } from '@muninn/ui'

/**
 * Feedback de las acciones (CLAUDE.md: toda acción avisa; lo que cambia datos ofrece «Deshacer», ADR-0019 y ADR-0025).
 * Sin dependencias de react-query ni del core: lo usan todas las acciones, también las de `queries.ts`.
 */

/** Errores de supabase-js al llamar a una Edge Function: llegan en inglés y sin nada útil para quien usa la app. */
const EDGE_ERRORS: Record<string, string> = {
  FunctionsFetchError: 'No se pudo hablar con el servidor de Muninn.',
  FunctionsRelayError: 'No se pudo hablar con el servidor de Muninn.',
  FunctionsHttpError: 'El servidor de Muninn respondió con un error.',
}

export const reason = (err: unknown) =>
  typeof navigator !== 'undefined' && navigator.onLine === false
    ? 'Sin conexión: vuelve a intentarlo cuando la recuperes.'
    : err instanceof Error
      ? (EDGE_ERRORS[err.name] ?? err.message)
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
  /** Aviso tras deshacer: un título, o título y opciones. Por defecto, «Cambio deshecho». */
  undone?: string | [string, NotifyOptions]
  failTitle?: string
}

/**
 * Aviso de éxito con «Deshacer»: cada acción es un comando con su inversa. Concentra lo que antes se copiaba en cada
 * acción, incluido el aviso si deshacer falla (sin él, el error se perdía en la consola).
 */
export function notifyUndo(
  title: string,
  { undo, undone = 'Cambio deshecho', failTitle = 'No se pudo deshacer', ...opts }: UndoOptions,
) {
  if (!undo) {
    notify.success(title, opts)
    return
  }
  notify.success(title, {
    ...opts,
    action: {
      label: 'Deshacer',
      onClick: async () => {
        try {
          if ((await undo()) === false) return
        } catch (err) {
          fail(failTitle, err)
          return
        }
        const [doneTitle, doneOpts] = typeof undone === 'string' ? [undone, undefined] : undone
        notify.info(doneTitle, doneOpts)
      },
    },
  })
}
