import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { generate, ICON_FILES } from '../scripts/icons'

describe('iconos generados', () => {
  for (const { catalog, generated } of ICON_FILES) {
    it(`${generated} está sincronizado con ${catalog} (pnpm --filter @muninn/ui icons)`, async () => {
      const file = readFileSync(new URL(`../src/${generated}`, import.meta.url), 'utf8')
      expect(file.replace(/\r\n/g, '\n')).toBe(await generate(catalog, generated))
    })
  }
})
