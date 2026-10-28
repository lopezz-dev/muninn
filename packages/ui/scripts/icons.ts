import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { IconWeight } from '@phosphor-icons/react/dist/lib/types'
import type { ReactElement } from 'react'

/**
 * Generador de `src/*.generated.ts` (ADR-0058): copia de Phosphor solo los grosores que usa la app.
 * Todos los iconos llevan regular y bold (`<IconDefaults>`, la barra de pestañas, `notify`…); el resto,
 * solo donde se pide. Si usas otro grosor en un icono, añádelo aquí y regenera (`pnpm --filter @muninn/ui icons`).
 */
const WEIGHTS: IconWeight[] = ['regular', 'bold']
const EXTRA_WEIGHTS: Record<string, IconWeight[]> = {
  PushPin: ['fill'], // nota fijada
}

/** Pares catálogo → fichero generado. Los de pantalla van aparte para no viajar en el arranque. */
export const ICON_FILES = [
  { catalog: 'icons.tsx', generated: 'icons.generated.ts' },
  { catalog: 'screen-icons.tsx', generated: 'screen-icons.generated.ts' },
] as const

const src = (file: string) => new URL(`../src/${file}`, import.meta.url)

/** Nombres de Phosphor que el catálogo importa del fichero generado. */
export function catalogNames(catalog: string, generated: string) {
  const code = readFileSync(src(catalog), 'utf8')
  const from = generated.replace(/\.ts$/, '')
  const block = code.match(new RegExp(`import \\{([^}]*)\\} from '\\./${from}'`))
  if (!block?.[1]) throw new Error(`${catalog} no importa de ./${from}`)
  return block[1]
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean)
    .sort()
}

const phosphorDir = dirname(
  createRequire(import.meta.url).resolve('@phosphor-icons/react/package.json'),
)

type Element = ReactElement<Record<string, unknown> & { children?: unknown }>

async function shapes(name: string) {
  const file = pathToFileURL(join(phosphorDir, 'dist', 'defs', `${name}.es.js`)).href
  const defs = (await import(file)).default as Map<IconWeight, Element>
  const weights = [...WEIGHTS, ...(EXTRA_WEIGHTS[name] ?? [])]
  const out: Record<string, [string, Record<string, unknown>][]> = {}
  for (const weight of weights) {
    const fragment = defs.get(weight)
    if (!fragment) throw new Error(`${name} no tiene grosor ${weight}`)
    const children = [fragment.props.children].flat() as Element[]
    out[weight] = children.map((child) => {
      const { children: nested, ...attrs } = child.props
      if (typeof child.type !== 'string' || nested) throw new Error(`${name}: forma no plana`)
      return [child.type, attrs]
    })
  }
  return out
}

/** Contenido del fichero generado para un catálogo. Determinista: lo comprueba un test. */
export async function generate(catalog: string, generated: string) {
  const lines = [
    `// Generado por scripts/build-icons.ts desde @phosphor-icons/react a partir de ${catalog}. No lo edites a mano.`,
    `import { phosphorIcon } from './phosphor'`,
    '',
  ]
  for (const name of catalogNames(catalog, generated)) {
    lines.push(
      `export const ${name} = /* @__PURE__ */ phosphorIcon('${name}', ${JSON.stringify(await shapes(name))})`,
    )
  }
  return `${lines.join('\n')}\n`
}
