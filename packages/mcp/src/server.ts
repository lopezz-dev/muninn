import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { annotationsOf, catalog, isExpectedError } from '@muninn/assistant/tools'
import type { Muninn } from '@muninn/core'

type ToolResult = { content: { type: 'text'; text: string }[]; isError?: boolean }

const ok = (data: unknown): ToolResult => ({
  content: [{ type: 'text', text: JSON.stringify(data) }],
})

/** Errores esperables (validación, no encontrado) vuelven al modelo como texto para que corrija. */
const run = async (fn: () => Promise<unknown>): Promise<ToolResult> => {
  try {
    return ok(await fn())
  } catch (err) {
    if (isExpectedError(err)) {
      return { content: [{ type: 'text', text: err.message }], isError: true }
    }
    throw err
  }
}

/**
 * Servidor MCP de Muninn. Expone el catálogo único de herramientas (`@muninn/assistant/tools`, ADR-0041), el mismo que
 * usa el asistente de la app, para Claude, Codex o un modelo local. No hay borrados definitivos: como mucho, archivar
 * (ADR-0009). Expone todo el catálogo, también lo de los módulos ocultos en la app (ADR-0028).
 */
export function createMuninnMcpServer(app: Muninn) {
  const server = new McpServer({ name: 'muninn', version: '0.2.0' })
  // El MCP no ofrece «Deshacer»: los cambios que anotan las herramientas se ignoran.
  const ctx = { app, changed: () => {} }
  for (const tool of catalog) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.input,
        annotations: annotationsOf(tool),
      },
      (args: Record<string, unknown>) => run(() => tool.run(ctx, args)),
    )
  }
  return server
}
