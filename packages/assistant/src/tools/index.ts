import type { ModuleName } from '@muninn/core'
import { z } from 'zod'
import type { AnyTool } from './define'
import { financeTools } from './finance'
import { newsTools } from './news'
import { noteTools } from './notes'
import { taskTools } from './tasks'

export * from './define'
export { resolveColumn, resolveProject } from './tasks'

/** Todas las herramientas de Muninn, en el orden en que se ofrecen. Ninguna borra de forma definitiva (ADR-0009). */
export const catalog: AnyTool[] = [...taskTools, ...noteTools, ...financeTools, ...newsTools]

/** Las herramientas de los módulos activos (y las que no dependen de ninguno). Sin módulos, todas (el MCP). */
export function toolsFor(modules?: readonly ModuleName[] | null, tools: AnyTool[] = catalog) {
  if (!modules) return tools
  return tools.filter((t) => t.module === null || modules.includes(t.module))
}

/** Pistas de MCP: nada es destructivo; lo de lectura, solo lectura. */
export function annotationsOf(tool: AnyTool) {
  return tool.access === 'read'
    ? { readOnlyHint: true, openWorldHint: false }
    : {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
        ...(tool.idempotent ? { idempotentHint: true } : {}),
      }
}

/** Esquema de argumentos en JSON Schema, para los modelos que llaman funciones (Ollama, OpenAI…). */
export function parametersOf(tool: AnyTool): Record<string, unknown> {
  const { $schema: _, ...schema } = z.toJSONSchema(z.object(tool.input), { io: 'input' }) as Record<
    string,
    unknown
  >
  return schema
}
