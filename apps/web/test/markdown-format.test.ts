import { describe, expect, it } from 'vitest'
import { applyFormat, continueList, type Edit, type FormatCommand } from '../src/markdown/format'
import { plainText } from '../src/markdown/plain'
import { countTasks, toggleTask } from '../src/markdown/tasks'

/** Aplica un `Edit` a un texto, como lo haría el campo, y devuelve el resultado con la selección. */
function run(edit: Edit, text: string) {
  const out = text.slice(0, edit.from) + edit.insert + text.slice(edit.to)
  return { out, sel: out.slice(edit.selStart, edit.selEnd), at: edit.selStart }
}

/** `fmt('bold', 'hola [mundo]')`: los corchetes marcan la selección. */
function fmt(cmd: FormatCommand, marked: string) {
  const start = marked.indexOf('[')
  const end = marked.lastIndexOf(']') - 1
  const text = marked.slice(0, start) + marked.slice(start + 1, end + 1) + marked.slice(end + 2)
  return run(applyFormat(cmd, text, start, end), text)
}

describe('negrita y cursiva', () => {
  it('envuelve la selección y la deja seleccionada', () => {
    expect(fmt('bold', 'hola [mundo]')).toMatchObject({ out: 'hola **mundo**', sel: 'mundo' })
    expect(fmt('italic', 'hola [mundo]')).toMatchObject({ out: 'hola *mundo*', sel: 'mundo' })
  })

  it('sin selección deja el cursor entre las marcas', () => {
    expect(fmt('bold', 'hola []')).toMatchObject({ out: 'hola ****', at: 7 })
  })

  it('quita la marca si ya está alrededor o dentro de la selección', () => {
    expect(fmt('bold', 'hola **[mundo]**').out).toBe('hola mundo')
    expect(fmt('bold', 'hola [**mundo**]').out).toBe('hola mundo')
    expect(fmt('italic', 'hola *[mundo]*').out).toBe('hola mundo')
  })

  it('la cursiva no confunde `**x**` con `*x*`', () => {
    expect(fmt('italic', '**[x]**').out).toBe('***x***')
    expect(fmt('italic', '***[x]***').out).toBe('**x**')
    expect(fmt('bold', '***[x]***').out).toBe('*x*')
  })
})

describe('título', () => {
  it('cicla ## → ### → sin título', () => {
    expect(fmt('heading', 'hola[]').out).toBe('## hola')
    expect(fmt('heading', '## hola[]').out).toBe('### hola')
    expect(fmt('heading', '### hola[]').out).toBe('hola')
  })

  it('cambia una lista por título y respeta la sangría', () => {
    expect(fmt('heading', '- cosa[]').out).toBe('## cosa')
  })

  it('el cursor sigue en su sitio al cambiar el prefijo', () => {
    expect(fmt('heading', 'ho[]la').at).toBe(5)
  })
})

describe('listas', () => {
  it('añade y quita viñetas en todas las líneas tocadas, sin tocar las vacías', () => {
    expect(fmt('bullet', '[uno\n\ndos]').out).toBe('- uno\n\n- dos')
    expect(fmt('bullet', '[- uno\n- dos]').out).toBe('uno\ndos')
  })

  it('no toca las líneas fuera de la selección', () => {
    expect(fmt('bullet', 'a\nb[b]\nc').out).toBe('a\n- bb\nc')
  })

  it('convierte entre viñeta y tarea', () => {
    expect(fmt('task', '[- uno]').out).toBe('- [ ] uno')
    expect(fmt('bullet', '[- [ ] uno]').out).toBe('- uno')
    expect(fmt('task', '[- [x] uno]').out).toBe('uno')
    expect(fmt('task', '[1. uno]').out).toBe('- [ ] uno')
  })

  it('mantiene la sangría', () => {
    expect(fmt('bullet', '  [uno]').out).toBe('  - uno')
  })
})

describe('código y enlace', () => {
  it('código en línea o bloque', () => {
    expect(fmt('code', 'usa [pnpm]').out).toBe('usa `pnpm`')
    expect(fmt('code', '[a\nb]').out).toBe('```\na\nb\n```')
    expect(fmt('code', '[```\na\nb\n```]').out).toBe('a\nb')
  })

  it('enlace: selecciona el destino para escribirlo', () => {
    expect(fmt('link', 'mira [esto]')).toMatchObject({
      out: 'mira [esto](https://)',
      sel: 'https://',
    })
    expect(fmt('link', '[]')).toMatchObject({ out: '[texto](https://)', sel: 'https://' })
  })

  it('con una URL seleccionada, selecciona el texto', () => {
    expect(fmt('link', '[https://muninn.app]')).toMatchObject({
      out: '[texto](https://muninn.app)',
      sel: 'texto',
    })
  })
})

describe('Enter en una lista', () => {
  const enter = (marked: string) => {
    const at = marked.indexOf('|')
    const text = marked.replace('|', '')
    const e = continueList(text, at, at)
    return e && run(e, text)
  }

  it('continúa con la misma marca, el número siguiente o una tarea sin marcar', () => {
    expect(enter('- uno|')?.out).toBe('- uno\n- ')
    expect(enter('* uno|')?.out).toBe('* uno\n* ')
    expect(enter('9. uno|')?.out).toBe('9. uno\n10. ')
    expect(enter('1) uno|')?.out).toBe('1) uno\n2) ')
    expect(enter('- [x] hecha|')?.out).toBe('- [x] hecha\n- [ ] ')
    expect(enter('  - anidado|')?.out).toBe('  - anidado\n  - ')
  })

  it('si cortas el elemento, lo que queda pasa al siguiente', () => {
    const r = enter('- uno| dos')
    expect(r?.out).toBe('- uno\n-  dos')
    expect(r?.at).toBe(8)
  })

  it('un elemento vacío termina la lista', () => {
    expect(enter('- uno\n- |')?.out).toBe('- uno\n')
    expect(enter('  - |')?.out).toBe('  ')
  })

  it('fuera de una lista, o dentro de la marca, es un Enter normal', () => {
    expect(enter('hola|')).toBeNull()
    expect(enter('|- uno')).toBeNull()
    expect(enter('-| uno')).toBeNull()
    expect(continueList('- a\n- b', 1, 5)).toBeNull()
  })
})

describe('casillas de tarea', () => {
  const doc = '- [ ] uno\n- [x] dos\n\n```\n- [ ] código\n```\n\n> - [ ] cita\n1. [X] tres'

  it('cuenta las casillas fuera de los bloques de código', () => {
    expect(countTasks(doc)).toBe(4)
    expect(countTasks('- [ ] a\n~~~\n- [ ] b\n~~~\n- [ ] c')).toBe(2)
    expect(countTasks('texto [ ] suelto\n-[ ] sin espacio')).toBe(0)
  })

  it('marca y desmarca por número', () => {
    expect(toggleTask(doc, 0)?.split('\n')[0]).toBe('- [x] uno')
    expect(toggleTask(doc, 1)?.split('\n')[1]).toBe('- [ ] dos')
    expect(toggleTask(doc, 2)).toContain('> - [x] cita')
    expect(toggleTask(doc, 3)).toContain('1. [ ] tres')
    expect(toggleTask(doc, 4)).toBeNull()
    // El código no se toca.
    expect(toggleTask(doc, 2)).toContain('- [ ] código')
  })
})

describe('vista previa en texto', () => {
  it('quita las marcas de Markdown', () => {
    const md =
      '# Título\n\n- [ ] **uno** y [un enlace](https://x.y)\n> cita con `código`\n\n```ts\nlet a\n```'
    expect(plainText(md)).toBe('Título uno y un enlace cita con código let a')
  })

  it('recorta con puntos suspensivos', () => {
    const s = plainText('palabra '.repeat(50), 20)
    expect(s.endsWith('…')).toBe(true)
    expect(s.length).toBeLessThanOrEqual(21)
  })
})
