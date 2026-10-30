import { type ModuleName, type Muninn, NotFoundError, ValidationError } from '@muninn/core'
import type { z } from 'zod'

/**
 * Catálogo único de herramientas (ADR-0041): lo usan el servidor MCP y el asistente de la app, con las mismas
 * descripciones, los mismos esquemas y las mismas reglas (sin borrados definitivos, resolución por nombre, importes
 * en euros). Una herramienta solo conoce el core: ni el SDK de MCP ni el proveedor del modelo.
 */

/** Adónde lleva «Abrir» desde un cambio del asistente. */
export type ChangeTarget =
  | { kind: 'task'; id: string; projectId: string }
  | { kind: 'project'; id: string }
  | { kind: 'note'; id: string }
  | { kind: 'finance' }

/** Un cambio de datos hecho por una herramienta, con su inversa para «Deshacer» (ADR-0019). */
export interface Change {
  tool: string
  /** «Tarea «Firmar en macOS» creada en HuginnDB». */
  summary: string
  /** Deshace el cambio con el core que se le pase: el de la UI, para que en la actividad conste `user`. */
  undo: (app: Muninn) => Promise<unknown>
  target?: ChangeTarget
}

export interface ToolContext {
  app: Muninn
  /** Anota un cambio. El MCP lo ignora; el asistente lo enseña con «Deshacer». */
  changed(change: Omit<Change, 'tool'>): void
}

export interface Tool<S extends z.ZodRawShape = z.ZodRawShape> {
  name: string
  title: string
  description: string
  /** Forma zod de los argumentos (el MCP la usa tal cual; el asistente la pasa a JSON Schema). */
  input: S
  /** `read` no cambia nada; `write` cambia datos, nunca de forma definitiva. */
  access: 'read' | 'write'
  idempotent?: boolean
  /** Módulo al que pertenece: el asistente solo ofrece las de los módulos activos (ADR-0028). */
  module: ModuleName | null
  /** Detalle corto para la UI («HuginnDB», «→ En curso»). */
  detail?: (args: z.infer<z.ZodObject<S>>) => string | undefined
  run(ctx: ToolContext, args: z.infer<z.ZodObject<S>>): Promise<unknown>
}

// biome-ignore lint/suspicious/noExplicitAny: el catálogo mezcla herramientas con argumentos distintos
export type AnyTool = Tool<any>

export const defineTool = <S extends z.ZodRawShape>(tool: Tool<S>): AnyTool => tool

/** Errores esperables (validación, no encontrado): vuelven al modelo como texto para que se corrija. */
export const isExpectedError = (err: unknown): err is Error =>
  err instanceof ValidationError || err instanceof NotFoundError

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Por id o por nombre: primero el nombre exacto (sin mayúsculas) y luego el primero que lo contiene (ADR-0009). */
export function byName<T extends { id: string; name: string }>(rows: T[], ref: string) {
  if (UUID.test(ref)) return rows.find((r) => r.id === ref)
  const needle = ref.trim().toLowerCase()
  return (
    rows.find((r) => r.name.toLowerCase() === needle) ??
    rows.find((r) => r.name.toLowerCase().includes(needle))
  )
}

/**
 * `byName` o un error de validación que enumera las opciones (`options`), para que el modelo se corrija con el nombre
 * bueno en vez de inventarse otro.
 */
export function pickByName<T extends { id: string; name: string }>(
  rows: T[],
  ref: string,
  notFound: () => string,
): T {
  const match = byName(rows, ref)
  if (!match) throw new ValidationError(notFound())
  return match
}

/** Los valores de `before` en los campos que cambia `patch`: lo que necesita «Deshacer» para dejarlo como estaba. */
export function previousOf<T extends object, K extends keyof T>(
  before: T,
  patch: Partial<Record<K, unknown>>,
  keys: readonly K[],
): Partial<Pick<T, K>> {
  return Object.fromEntries(
    keys.filter((k) => patch[k] !== undefined).map((k) => [k, before[k]]),
  ) as Partial<Pick<T, K>>
}
