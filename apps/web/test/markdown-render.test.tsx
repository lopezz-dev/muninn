import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Markdown, safeHref } from '../src/markdown/Markdown'

const html = (source: string, onToggleTask?: (i: number) => void) =>
  renderToStaticMarkup(<Markdown source={source} onToggleTask={onToggleTask} />)

describe('Markdown: formato', () => {
  it('títulos, énfasis, código y listas', () => {
    const out = html(
      '## Hola\n\nUn **fuerte**, una *cursiva*, `código` y ~~tachado~~.\n\n- a\n- b\n\n1. uno\n2. dos',
    )
    expect(out).toContain('<h2')
    expect(out).toContain('<strong')
    expect(out).toContain('<em>cursiva</em>')
    expect(out).toContain('<code')
    expect(out).toContain('<del')
    expect(out).toContain('<ul')
    expect(out).toContain('<ol')
  })

  it('tablas, citas y bloques de código', () => {
    const out = html('| a | b |\n|---|:-:|\n| 1 | 2 |\n\n> cita\n\n```\nlet a = 1\n```')
    expect(out).toContain('<table')
    expect(out).toContain('text-center')
    expect(out).toContain('<blockquote')
    expect(out).toContain('<pre')
    expect(out).toContain('let a = 1')
  })

  it('las entidades no se duplican ni se pierden', () => {
    const out = html('a & b < c > d "e" &amp; f')
    expect(out).toContain('a &amp; b &lt; c &gt; d &quot;e&quot; &amp; f')
  })

  it('las listas de tareas llevan casillas, de solo lectura sin manejador', () => {
    const ro = html('- [ ] uno\n- [x] dos')
    expect(ro.match(/type="checkbox"/g)).toHaveLength(2)
    expect(ro).toContain('disabled')
    expect(ro).toContain('checked')
    expect(html('- [ ] uno', () => {})).not.toContain('disabled')
  })

  it('si la vista y el texto no cuentan las mismas casillas, son de solo lectura', () => {
    // Una casilla con sangría de código: marked no la ve como lista y la regex tampoco.
    // Una con `+` y sangría de 4 dentro de una lista sí coinciden; aquí provocamos el desajuste:
    // la regex cuenta lo que hay dentro de un bloque de HTML que marked no pinta como lista.
    const out = html('<div>\n- [ ] dentro del html\n</div>', () => {})
    expect(out).not.toContain('type="checkbox"')
  })
})

describe('Markdown: saneado', () => {
  it('el HTML se muestra como texto, nunca como elementos', () => {
    const out = html(
      '<script>alert(1)</script>\n\nhola <img src=x onerror=alert(1)> mundo\n\n<div onclick="x()">caja</div>',
    )
    expect(out).not.toContain('<script')
    expect(out).not.toContain('<img')
    expect(out).not.toContain('<div onclick')
    expect(out).toContain('&lt;script&gt;')
  })

  it('solo se enlaza a http, https, mailto y tel', () => {
    for (const href of [
      'javascript:alert(1)',
      'JaVaScRiPt:alert(1)',
      ' javascript:alert(1)',
      'jav&#x09;ascript:alert(1)',
      'data:text/html;base64,PHNjcmlwdD4=',
      'vbscript:x',
      '//evil.example',
      '/ruta/relativa',
      'file:///etc/passwd',
    ]) {
      const out = html(`[clic](${href})`)
      expect(out, href).not.toContain('<a ')
      expect(out, href).toContain('clic')
    }
    expect(html('[ok](https://muninn.app/x?a=1&b=2)')).toContain(
      'href="https://muninn.app/x?a=1&amp;b=2"',
    )
    expect(html('[ok](mailto:a@b.c)')).toContain('href="mailto:a@b.c"')
  })

  it('los enlaces se abren aparte y sin referrer', () => {
    const out = html('https://muninn.app')
    expect(out).toContain('target="_blank"')
    expect(out).toContain('rel="noopener noreferrer"')
  })

  it('las imágenes no se cargan', () => {
    const out = html('![gato](https://x.y/gato.png) y ![](javascript:alert(1))')
    expect(out).not.toContain('<img')
    expect(out).toContain('gato')
    expect(out).not.toContain('javascript:')
  })

  it('un enlace con HTML dentro del texto no se escapa de su sitio', () => {
    const out = html('[<b onmouseover=alert(1)>x</b>](https://a.b)')
    expect(out).not.toContain('<b ')
  })

  it('safeHref', () => {
    expect(safeHref('https://a.b')).toBe('https://a.b')
    expect(safeHref('  http://a.b ')).toBe('http://a.b')
    expect(safeHref('#ancla')).toBeNull()
    expect(safeHref('javascript:1')).toBeNull()
  })
})
