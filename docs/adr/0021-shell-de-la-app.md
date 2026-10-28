# ADR-0021: Shell de la app: barra lateral en escritorio, dock con menisco en móvil y ⌘K

- **Estado:** Reemplazado por ADR-0054 en el móvil (dock) y en el corte de la barra lateral; lo demás sigue vigente
- **Fecha:** 2026-10-19
- **Área:** web, ui

## Contexto

El diseño de referencia (lienzo «Muninn — Pantallas») define dos navegaciones: una barra lateral de 240 px
en escritorio (Sidebar.dc.html) y un dock flotante con «menisco» en móvil (Dock.dc.html), con el
Asistente en el centro. El buscador ⌘K (Buscador.dc.html) es el punto de entrada a todo. La apariencia
(cristal y acento) debe poder cambiarse ya, aunque todavía no exista `user_settings` en Supabase.

## Decisión

- **Un solo shell** (`apps/web/src/shell/AppShell.tsx`) para todas las rutas. El corte está en **768 px**
  (`md` de Tailwind): por encima, barra lateral; por debajo, dock. Ambos se renderizan y se ocultan por CSS,
  sin `matchMedia` en JS, para que no haya parpadeo ni discrepancias al girar el móvil.
- **Dock:** cinco pestañas (Inicio, Proyectos, Asistente, Finanzas, Más). Lo que no tiene pestaña propia
  (Notas, Noticias, GitHub, Documentación, Ajustes) vive en «Más» y marca esa pestaña. Márgenes de 20 px,
  22 px al borde inferior más la zona segura del iPhone, y pestañas de 63,6 × 62 px (≥ 44 px).
- **La animación del dock va en JS, no en CSS.** El trazado del menisco (`dockPath`), el recorte del fondo
  (`clip-path: path()`), la burbuja y el halo se pintan en cada fotograma desde una única posición, con la
  curva del diseño (`cubic-bezier(.3,.7,.2,1)`, 450 ms). La transición de la propiedad CSS `d` sería más
  corta de escribir, pero **Safari no la anima**, y el móvil objetivo es un iPhone. Si el navegador no da
  fotogramas, un temporizador fija el destino al acabar (no se queda a medias).
- **Foco al navegar:** al cambiar de sección, el foco pasa a `<main id="contenido">`; el primer Tab lleva a
  «Saltar al contenido». Cada pantalla fija su título (`PageHeader` → «Notas · Muninn»).
- **⌘K / Ctrl+K** abre el buscador desde cualquier sitio (también dentro de un campo). Busca secciones,
  proyectos y acciones sin distinguir tildes, preselecciona lo que empieza por lo escrito y, si no hay nada
  así, ofrece «Preguntar a Muninn». Patrón ARIA *combobox* + *listbox* con `aria-activedescendant`.
- **Apariencia en `localStorage`** (`muninn.appearance`) hasta que exista `user_settings.preferences`.
  Se aplica antes del primer render, se sincroniza entre pestañas (evento `storage`) y, sin preferencia
  guardada, respeta «Reducir transparencia» del sistema. Cada cambio da feedback con «Deshacer».
- **Pantallas sin función todavía** muestran un estado vacío honesto: qué será, en qué fase llega y, si se
  puede, una acción real (crear proyecto). Nunca botones que no hacen nada.

## Alternativas consideradas

- **Barra de pestañas estándar en móvil:** más simple, pero no es el diseño aprobado.
- **Animar el dock con CSS `d: path()`:** no funciona en Safari/WebKit (el objetivo principal en móvil).
- **Animar el dock con SVG SMIL (`<animate>`):** no permite interrumpir a mitad y redirigir con suavidad
  si se cambia de pestaña durante la transición.
- **Guardar la apariencia en el core ya:** obligaría a crear `user_settings` en el store de memoria sin
  login. Se hará con Supabase; la UI solo cambiará la capa `lib/appearance.ts`.

## Consecuencias

- La navegación de cada sección está en un solo sitio (`shell/nav.ts`): barra lateral, dock y buscador la
  comparten.
- En modo demo los proyectos viven en memoria y se pierden al recargar; la barra lateral lo dice.
- Al llegar el login, la apariencia pasará a Supabase y `localStorage` quedará como caché para el primer
  render.
- Relacionado: [ADR-0015](0015-modo-cristal.md), [ADR-0019](0019-feedback-con-notificaciones.md),
  [ADR-0020](0020-tanstack-router-carga-diferida.md), [gotchas/web](../gotchas/web.md).
