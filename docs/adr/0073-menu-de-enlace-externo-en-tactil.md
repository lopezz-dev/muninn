# ADR-0073: En pantallas táctiles, un enlace que sale de Muninn abre antes un menú «Abrir enlace · Copiar enlace»

- **Estado:** Aceptado
- **Fecha:** 2026-10-31
- **Área:** web, ui

## Contexto

En el iPhone, un toque sin querer sobre un enlace de una descripción, una nota o una noticia sacaba de Muninn al
momento: Safari se abre encima de la PWA y hay que volver a mano. Con el dedo es fácil tocar un enlace al hacer scroll o
al querer editar el texto que lo rodea. La regla de UX del proyecto ([ADR-0019](0019-feedback-con-notificaciones.md)) es
que no hay diálogos de confirmación: lo que cambia datos se deshace con «Deshacer». Abrir un enlace no cambia datos, pero
tampoco se puede deshacer desde Muninn.

Todos los enlaces externos pasan ya por un mismo sitio: `externalLink` (`lib/external-link.ts`), que abre con
`window.open` o, en el escritorio, con el sistema.

## Decisión

- **En pantallas táctiles** (`(pointer: coarse)`), tocar un enlace externo abre un **menú pequeño junto al enlace**: dice
  adónde lleva («Sale de Muninn · github.com») y ofrece **Abrir enlace** y **Copiar enlace**. Se cierra tocando fuera, con
  Escape o al hacer scroll. No es un diálogo: no tapa la pantalla ni pregunta «¿seguro?», y su segunda opción también es útil
  por sí misma.
- **Con ratón** (el ordenador, la app de escritorio) el clic abre directo, como siempre: ahí el clic sin querer es raro y se
  ve la URL al pasar por encima. ⌘/Ctrl/Mayús-clic siguen siendo del navegador.
- **Con el teclado** (Enter, `detail` 0) se abre directo: llegar al enlace con Tab ya es intención.
- **Botones que ya dicen que abren fuera** (el «Abrir» de una noticia) llevan `direct: true` y no piden el menú. Un enlace
  dentro de un texto, de una fila o de una insignia sí lo pide.
- El estado vive en `lib/link-menu.ts` (unas líneas en el arranque) y el menú (`shell/LinkMenu.tsx`, con el `Popover` de
  `@muninn/ui`) es un chunk que se pide al primer toque. Fuera del shell (la pantalla de entrada) no hay quien lo pinte y el
  enlace se abre directo.

## Alternativas consideradas

- **Diálogo de confirmación («Vas a salir de Muninn»):** va contra ADR-0019 y añade un paso a cada enlace, también a los que
  sí querías abrir.
- **Primer toque selecciona, segundo abre:** no se descubre (el primer toque parece no hacer nada) y un doble toque rápido
  vuelve a abrir sin querer.
- **Mantener pulsado para abrir:** el iPhone ya usa la pulsación larga para su propia vista previa de enlaces, y los enlaces
  dejarían de parecer enlaces.
- **Abrir dentro de Muninn (visor propio):** la PWA no puede mostrar otra web sin `iframe`, que muchas webs bloquean
  (ver ADR-0057 para las noticias, que sí se leen dentro).

## Consecuencias

- Positivas: un toque sin querer ya no saca de la app, y copiar un enlace en el móvil pasa a estar a un toque.
- Negativas / costes: abrir un enlace en el móvil cuesta dos toques. Un enlace nuevo que no use `externalLink` no tendrá el
  menú: todos los externos deben pasar por ahí.
- Relacionado: [gotchas/web](../gotchas/web.md), `lib/external-link.ts`, `lib/link-menu.ts`, `shell/LinkMenu.tsx`,
  [ADR-0019](0019-feedback-con-notificaciones.md).
