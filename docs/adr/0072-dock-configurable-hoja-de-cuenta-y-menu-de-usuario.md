# ADR-0072: Dock configurable con tu avatar y hoja «Tu cuenta» en el teléfono; menú de usuario en el ordenador

- **Estado:** Aceptado
- **Fecha:** 2026-10-30
- **Área:** web, ui
- **Reemplaza a:** [ADR-0054](0054-shell-responsive-en-tres-tamanos.md) en lo que toca a las pestañas del teléfono, el botón
  del Asistente y «Más»

## Contexto

Con el ADR-0054, el teléfono tenía cuatro pestañas fijas (Inicio, Proyectos, Finanzas, Más) y un botón grande con el
logo que abría el Asistente. Tres problemas:

- **El Asistente no contesta en el móvil** (usa el modelo del ordenador, ADR-0041): el botón más visible de la barra
  llevaba a una pantalla que no sirve ahí.
- **«Más» y Ajustes se perdían:** desde Más › Cuenta, «‹ Ajustes» llevaba a `/ajustes` y no volvía a Más. Ajustes era
  una pantalla con su propio historial dentro de otra (Más), y cada vuelta atrás dependía de un enlace fijo.
- **Cada uno usa secciones distintas:** quien vive en Notas o en Noticias tenía que pasar por «Más» siempre.

En el ordenador, Documentación y Ajustes ocupaban dos filas al pie de la barra, encima del usuario, que solo llevaba a
Ajustes › Cuenta.

Se debatió el 30 de octubre con un prototipo (lienzo «Dock y cuenta», fuera del repo).

## Decisión

- **Teléfono (< 768 px): barra configurable y tu avatar.**
  - De **1 a 4 pestañas** que eliges tú, con su orden, entre Inicio, Proyectos, Notas, Finanzas, Noticias, GitHub,
    Documentación y **Buscar** (abre el buscador ⌘K; no es una pantalla). Por defecto: Inicio, Proyectos, Finanzas, Notas.
  - Se guarda en tu cuenta, en `user_settings.preferences.dock` (lista de ids), como la apariencia: te sigue entre
    dispositivos. Sin migración: `preferences` ya es JSON libre. Se valida al leer (`parseDock` en `shell/nav.ts`):
    desconocidos y repetidos fuera, cuatro como mucho y, si no queda nada, la de fábrica.
  - Las de un módulo desactivado no se pintan (`tabsFor`) pero siguen guardadas: al reactivarlo, vuelven.
  - **El Asistente no se puede poner** mientras no conteste en el móvil. Sale atenuado en Ajustes › Barra de abajo y en
    «Ir a», con «En el ordenador».
  - A la derecha, **siempre tu avatar**, en el sitio del antiguo botón del Asistente.
- **Hoja «Tu cuenta» en lugar de «Más» y de la pantalla de Ajustes.** El avatar abre una hoja inferior
  (`SheetContent side="bottom"`) con: tu tarjeta (→ Cuenta, con Cerrar sesión al final), «Ir a» con lo que no está en tu
  barra, los Ajustes por grupos (ADR-0053), Documentación y Acerca de. Cada sección se abre **dentro de la hoja**, con
  «‹» para volver; al cerrarla (tocar fuera, Esc o arrastrar el asa hacia abajo) sigues en la pantalla en la que estabas.
  - **La hoja no es una ruta.** Su estado (abierta y la pila de vistas) vive en un *store* fuera de React
    (`lib/account-sheet.ts`), para que el router la pueda abrir antes de pintar.
  - Los cuerpos de las secciones son los mismos que en el ordenador (`SectionContent` de `screens/ajustes/Seccion.tsx`).
- **Enlaces a `/ajustes/<sección>` en el teléfono** abren la hoja en esa sección encima de la pantalla actual (o de
  Inicio si se entra de cero). Dos caminos: un clic en un enlace se intercepta en el shell antes que el `<Link>`; lo que
  llega por dirección o navegación por código lo resuelve el `beforeLoad` de `/ajustes`, que abre la hoja y redirige a
  la pantalla de antes. En el ordenador, `/ajustes` sigue igual.
- **`/mas` desaparece:** redirige a Inicio con la hoja abierta (a Inicio sin más en el ordenador).
- **Ordenador: menú de usuario.** El pie de la barra queda en una fila: tu usuario. Al pulsarlo se abre un menú hacia
  arriba (a la derecha con la barra en raíl) con Cuenta, Ajustes, Atajos de teclado, Documentación, Acerca de y Cerrar
  sesión. Se abre también con **⌘⇧U / Ctrl ⇧ U**, que no choca con ⌘K ni con los atajos del tablero. El menú va en un
  chunk diferido para que el `DropdownMenu` de Radix no entre en el arranque.
- **La barra lateral se puede plegar** a raíl en el ordenador con un botón junto al logo; se recuerda en este
  dispositivo (`localStorage`). En tablet sigue siendo raíl siempre (ADR-0054).
- Se mantiene del ADR-0054: los tres tamaños, la barra que se encoge al bajar, `overflow-x: clip` en el teléfono y el
  raíl en tablet.

## Alternativas consideradas

- **Arreglar el «‹» de Ajustes y dejar «Más»:** resolvía el enlace roto, pero no el botón del Asistente ni que cada uno
  necesita pestañas distintas.
- **Ajustes como pantalla con historial propio dentro de la hoja** (rutas `/ajustes/...` también en el móvil): el botón
  atrás del sistema mezclaría la navegación de la hoja con la de la app, y cerrar la hoja tendría que «deshacer» rutas.
- **La barra en este dispositivo (`localStorage`):** más sencillo, pero el teléfono y la tablet de la misma persona
  tendrían barras distintas, al revés que la apariencia.
- **Hasta cinco pestañas:** con nombres y el avatar, en 358 px no caben con holgura (lo mismo que en el ADR-0054).
- **El Asistente en la barra aunque no conteste:** volvería a poner a un toque algo que en el móvil no funciona.

## Consecuencias

- Positivas: la barra del teléfono enseña lo que cada uno usa; Ajustes y la cuenta están a un toque desde cualquier
  pantalla y no te sacan de ella; el pie de la barra del ordenador gana dos filas.
- Negativas / costes: un enlace a `/ajustes/...` por código en el teléfono (`navigate`) deja una entrada repetida en el
  historial (la redirección reemplaza la entrada nueva por la pantalla de antes); los clics normales no, porque se
  interceptan antes. La hoja depende de que el *store* se cierre al cambiar de pantalla (`AppShell` mira la ruta ya
  resuelta). Ver docs/gotchas/web.md.
- Relacionado: [ADR-0053](0053-ajustes-por-grupos-buscador-y-restablecer.md), [ADR-0054](0054-shell-responsive-en-tres-tamanos.md),
  [ADR-0041](0041-asistente-local-con-catalogo-unico.md), `apps/web/src/shell/TabBar.tsx`, `apps/web/src/shell/AccountSheet.tsx`,
  `apps/web/src/shell/UserMenu.tsx`, `apps/web/src/lib/account-sheet.ts`, `apps/web/src/lib/dock.ts`,
  `apps/web/src/screens/ajustes/Barra.tsx`.
