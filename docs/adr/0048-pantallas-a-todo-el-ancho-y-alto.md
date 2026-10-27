# ADR-0048: Las pantallas ocupan todo el ancho y, en escritorio, todo el alto

- **Estado:** Aceptado
- **Fecha:** 2026-10-27
- **Área:** web, ui

## Contexto

`Page` limitaba el contenido a 1200 px centrados (`mx-auto max-w-[1200px]`), y Ajustes y el Asistente
copiaban ese tope. En un monitor de 1920 px, con la barra lateral de 240 px, quedaban unos 240 px vacíos a
cada lado. Además, nada estiraba el contenido en vertical: el panel de Inicio y el tablero acababan a media
pantalla. Se veía como una columna «forzada» en el centro, no como una app de escritorio.

## Decisión

- **`Page` no tiene ancho máximo:** ocupa todo lo que deja `<main>` (menos su relleno de 32 px).
- **`<main>` es una columna flex y `Page` es `flex-1`:** llega siempre al pie de la ventana. Lo que deba
  repartirse el alto sobrante lleva `flex-1` en el punto de corte donde aplica (`lg:` en Inicio, `md:` en
  Notas). En móvil todo sigue fluyendo como antes.
- Pantalla a pantalla: en Inicio, las dos filas de tarjetas se reparten el alto y las barras de «Últimos 7
  días» crecen con su tarjeta. Las columnas del tablero llegan al pie, y se puede soltar en todo su alto. La
  caja de escribir del Asistente baja al pie. El «Elige una nota» llena el hueco del editor. Proyectos pasa
  a cuatro columnas en `2xl`.
- **Se mantiene la medida de lectura** donde hay prosa larga: el artículo de Documentación (720 px) y los
  textos de los estados vacíos (`max-w-md`). Líneas de más de ~80 caracteres se leen peor.

## Alternativas consideradas

- **Subir el tope (1440–1600 px):** en pantallas grandes vuelve a quedar centrado y con huecos; es el mismo
  problema más tarde.
- **Alto fijo con `h-dvh` y scroll dentro de cada tarjeta:** el panel quedaría a pantalla exacta, pero
  esconde contenido en scrolls anidados y rompe la página en ventanas bajas. Con `flex-1` el contenido
  llena el alto si sobra sitio y, si no cabe, la página hace scroll como siempre.

## Consecuencias

- Positivas: aprovecha monitores anchos; el panel y el tablero se sienten «de app», no de documento.
- Negativas / costes: las rejillas deben pensar en anchos de 1600 px o más (más columnas en `2xl` o
  tarjetas que estiren bien). Una pantalla nueva que quiera llenar el alto tiene que poner `flex-1` en su
  bloque principal: no ocurre solo.
- Relacionado: [ADR-0021](0021-shell-de-la-app.md) (shell), `apps/web/src/components/Page.tsx`,
  `apps/web/src/shell/AppShell.tsx`.
