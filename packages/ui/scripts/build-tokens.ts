import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { tokensToCss } from '../src/tokens'

const out = fileURLToPath(new URL('../src/tokens.css', import.meta.url))
writeFileSync(out, tokensToCss())
console.log(`tokens → ${out}`)
