# ADR-0056: Logo y portada de proyecto por separado, con el color del logo como color del proyecto

- **Estado:** Aceptado
- **Fecha:** 2026-10-28
- **Área:** core, db, web
- **Reemplaza a:** [ADR-0055](0055-imagen-de-proyecto-en-storage.md) en «una sola imagen por proyecto»; el resto
  (Storage privado, URL firmadas, reducir en el navegador, no borrar la anterior) sigue vigente

## Contexto

Con una sola imagen, la portada de la tarjeta y el icono eran la misma foto: un logo quedaba pixelado y recortado como
banner, y una foto ancha quedaba cortada como icono. Al probarlo, el autor pidió que la portada fuera personalizable o,
si no, que tomara un color del logo para que la tarjeta no quedara «mal».

## Decisión

- **Dos imágenes opcionales e independientes:**
  - **Logo** (`projects.image_path`, el campo que ya existía): el icono cuadrado de la tarjeta, la barra lateral, la
    cabecera del tablero y la lista del teléfono. Se reduce a 512 px y se guarda en **PNG**, para conservar la
    transparencia: el logo queda sobre el tinte del color del proyecto.
  - **Portada** (`projects.cover_path`, migración `20261028150000_project_cover`): el banner de la tarjeta en tablet y
    ordenador. Se reduce a 1200 px en JPEG, como antes.
- **Sin portada, el banner es un degradado del color del proyecto**, no un bloque plano.
- **El color del logo:** al elegir un logo, la app saca su color dominante en el navegador (`dominantColor` en
  `lib/project-image.ts`: miniatura de 32 × 32, tonos agrupados de 15 en 15°, sin transparentes, grises ni casi
  blancos o negros, y llevado a una claridad del 60 % para que se lea sobre el fondo oscuro). Se ofrece como muestra
  **«Del logo»** y se selecciona sola si no se había elegido color a mano. Un logo en blanco y negro no propone color.
- **El color del proyecto puede ser un hex** (`#8C64F0`) además de los nombres de la paleta (`blue`, `amber`…).
  `ColorDot`, `ProgressBar` y `ProjectAvatar` ya aceptan los dos; el esquema no cambia (`color` es texto libre de hasta
  32 caracteres).
- Core: `projects.setImage(id, blob, 'logo' | 'cover')` y `projects.restoreImage(id, ruta, 'logo' | 'cover')`; el
  resumen trae `coverPath`. Las mismas políticas de Storage valen para las dos.

## Alternativas consideradas

- **Solo el color del logo, sin portada:** resuelve el «queda mal», pero quien quiera una foto de su proyecto (un local,
  una obra, una app) no podría ponerla.
- **Solo la portada, sin color del logo:** con un logo y sin portada el banner volvería a quedar del color por defecto.
- **Sacar el color al pintar, de la URL firmada:** el canvas no puede leer píxeles de otro origen sin CORS y lo haría
  cada vez. Se calcula una vez, con el archivo aún en el dispositivo, y se guarda como el color del proyecto.
- **Columna aparte para el color del logo:** dos colores por proyecto confunden. Si el usuario elige otro color, manda
  el suyo.

## Consecuencias

- Positivas: el logo se ve nítido y entero; la tarjeta queda a juego con el logo aunque no haya portada.
- Negativas / costes: el color «Del logo» es una aproximación: con logos de varios colores elige el que más pesa, y el
  usuario puede cambiarlo. Los proyectos que ya tenían imagen la conservan como logo y no tienen portada.
- Relacionado: [ADR-0055](0055-imagen-de-proyecto-en-storage.md), `apps/web/src/lib/project-image.ts`,
  `apps/web/src/shell/ProjectDialog.tsx`, `apps/web/src/components/ProjectAvatar.tsx`,
  `supabase/migrations/20261028150000_project_cover.sql`.
