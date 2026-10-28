import { runAssistant } from '../src/agent'
import type { ChatProvider } from '../src/provider'
import { createScriptedProvider } from '../src/providers/scripted'
import { BENCH, type BenchCase, type BenchVerdict, evaluate } from './cases'
import { benchFixture } from './fixture'

export interface BenchRow extends BenchVerdict {
  say: string
  ms: number
  tools: string[]
  text: string
  error?: string
}

/** Cada caso, con datos nuevos, contra el proveedor que se le dé (por defecto, su guion ideal). */
export async function runBench(
  providerFor: (c: BenchCase) => ChatProvider = (c) =>
    createScriptedProvider([{ when: () => true, steps: c.ideal }]),
  options: { only?: string[] } = {},
): Promise<BenchRow[]> {
  const rows: BenchRow[] = []
  for (const c of BENCH.filter((x) => !options.only?.length || options.only.includes(x.id))) {
    const app = await benchFixture()
    const started = performance.now()
    try {
      const result = await runAssistant([{ role: 'user', content: c.say }], {
        provider: providerFor(c),
        app,
        conversationId: `bench-${c.id}`,
      })
      const verdict = await evaluate(c, result, app)
      rows.push({
        ...verdict,
        say: c.say,
        ms: Math.round(performance.now() - started),
        tools: result.tools.map((t) => `${t.name}${t.status === 'error' ? ' ✗' : ''}`),
        text: result.text,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      rows.push({
        id: c.id,
        pass: false,
        problems: [message],
        say: c.say,
        ms: Math.round(performance.now() - started),
        tools: [],
        text: '',
        error: message,
      })
    }
  }
  return rows
}
