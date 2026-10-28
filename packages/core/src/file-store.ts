import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { createMemoryStore, emptySnapshot, type MemorySnapshot } from './memory-store'
import type { Store } from './store'

/**
 * Store local en un fichero JSON (solo Node). Permite usar Muninn desde el MCP sin Supabase
 * y es la vía de escape "todo en mi máquina". Escribe de forma atómica tras cada cambio.
 */
export function createFileStore(path: string): Store {
  const initial: MemorySnapshot = existsSync(path)
    ? { ...emptySnapshot(), ...JSON.parse(readFileSync(path, 'utf8')) }
    : emptySnapshot()

  mkdirSync(dirname(path), { recursive: true })

  return createMemoryStore(initial, {
    onChange(snapshot) {
      const tmp = `${path}.tmp`
      writeFileSync(tmp, JSON.stringify(snapshot, null, 2))
      renameSync(tmp, path)
    },
  })
}
