/**
 * Banco de pruebas contra Ollama de verdad (ADR-0041). Fase final, en el ordenador con el modelo:
 *
 *   pnpm --filter @muninn/assistant bench -- --model qwen3:8b
 *   pnpm --filter @muninn/assistant bench -- --model qwen3:14b --only gasto-cine,tarea-urgente-viernes
 *
 * Opciones: --model (qwen3:8b), --url (http://localhost:11434), --only (ids separados por comas), --think.
 * Corre sobre datos de ejemplo en memoria: no toca tu cuenta. Sale con código 1 si falla algún caso.
 */
import { runBench } from '../bench/run'
import { createOllamaProvider, DEFAULT_MODEL, OLLAMA_URL } from '../src/providers/ollama'

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const model = arg('model') ?? DEFAULT_MODEL
const baseUrl = arg('url') ?? OLLAMA_URL
const only = arg('only')?.split(',').filter(Boolean)
const think = process.argv.includes('--think')

const provider = createOllamaProvider({ model, baseUrl, think })
const status = await provider.status()
if (status.state !== 'ready') {
  console.error(
    status.state === 'offline'
      ? `Ollama no responde en ${baseUrl} (${status.detail ?? 'sin detalle'}). ¿Está abierto?`
      : `Falta el modelo ${model}. Descárgalo con: ollama pull ${model}\nTienes: ${status.models.join(', ') || '(ninguno)'}`,
  )
  process.exit(2)
}

console.log(`Banco de pruebas · ${model} en ${baseUrl}${think ? ' · con razonamiento' : ''}\n`)
const rows = await runBench(() => provider, { only })
for (const r of rows) {
  console.log(`${r.pass ? '✓' : '✗'} ${r.id.padEnd(24)} ${String(r.ms).padStart(6)} ms  «${r.say}»`)
  console.log(`    herramientas: ${r.tools.join(', ') || '(ninguna)'}`)
  if (!r.pass) console.log(`    problemas: ${r.problems.join('; ')}`)
  console.log(`    respuesta: ${r.text.replace(/\s+/g, ' ').slice(0, 200)}\n`)
}
const passed = rows.filter((r) => r.pass).length
const total = rows.reduce((s, r) => s + r.ms, 0)
console.log(`${passed}/${rows.length} casos bien · ${(total / 1000).toFixed(1)} s en total`)
process.exit(passed === rows.length ? 0 : 1)
