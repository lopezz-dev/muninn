import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { generate, ICON_FILES } from './icons'

for (const { catalog, generated } of ICON_FILES) {
  const out = fileURLToPath(new URL(`../src/${generated}`, import.meta.url))
  writeFileSync(out, await generate(catalog, generated))
  console.log(`iconos → ${out}`)
}
