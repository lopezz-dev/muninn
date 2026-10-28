# ADR-0055: Imagen de proyecto en Supabase Storage, reducida en el navegador y sin borrar la anterior

- **Estado:** Aceptado
- **Fecha:** 2026-10-28
- **Área:** core, db, web

## Contexto

Con el rediseño de Proyectos (lienzo «Muninn — Móvil 2.0», fila «Proyectos · tres tamaños») el autor pidió poder
ponerle una imagen a cada proyecto para reconocerlo de un vistazo, además del color. Hasta ahora la app no guardaba
archivos de usuario: no había ningún bucket de Storage. Tampoco se podía editar un proyecto desde la app (ni el nombre,
ni el color, ni la descripción, aunque el modelo la tenía).

## Decisión

- **Una sola imagen por proyecto, opcional.** Es la portada de la tarjeta en tablet y ordenador, y el icono en el
  teléfono, la barra lateral y la cabecera del tablero (`ProjectAvatar` y `ProjectCover`). Sin imagen se ven la inicial y
  el color. El color se mantiene siempre (franja bajo la portada, puntos del tablero).
- **Dónde se guarda:** columna `projects.image_path` (la ruta, no la URL) y bucket **privado** `project-images`, con la
  ruta `<owner_id>/<project_id>/<uuid>.<ext>`. Las políticas de `storage.objects` solo dejan leer y subir en la carpeta
  del propio usuario. Se pinta con **URL firmadas de un día** que la app pide al pintarla (`projects.imageUrl`, consulta
  `project-image` con 12 h de vigencia); nunca se guardan en la base de datos.
- **El acceso pasa por el core**, como todo: `store.projectImages` (`upload`, `url`) lo implementan el store de Supabase
  y el de memoria (el modo demo usa `blob:` locales). El servicio expone `projects.setImage`, `projects.restoreImage`,
  `projects.imageUrl` e `imagesEnabled`. Un store sin imágenes (el fichero local del MCP) no las ofrece y la UI esconde
  el selector.
- **Se reduce en el navegador** (`lib/project-image.ts`): lado mayor de 1200 px, JPEG al 85 % sobre el fondo de las
  tarjetas (un PNG transparente no queda en negro). El core admite JPEG, PNG y WebP de hasta 2 MB; el bucket repite
  esos límites.
- **Nunca se borra una imagen del almacén.** «Quitar» o cambiarla solo cambia `image_path`, y «Deshacer» vuelve a la
  anterior con `restoreImage`, que solo acepta rutas de ese proyecto. Por eso no hay política de borrado en Storage.
- **El MCP no sube imágenes:** `imagePath` no está en `updateProjectInput`, así que el catálogo de herramientas no la ve.
  Al crear un proyecto puede ponerle descripción, como antes.

## Alternativas consideradas

- **Bucket público:** URL fijas y cacheables, pero cualquiera con el enlace vería la imagen. Muninn guarda datos
  personales: privado y URL firmadas.
- **Guardar la imagen en la fila (base64) o en `preferences`:** filas pesadas en cada lectura del tablero y del
  tiempo real, y la caché sin conexión crecería con cada imagen.
- **Borrar la imagen anterior al cambiarla:** ahorra espacio, pero rompe «Deshacer» (ADR-0019). Con imágenes de unos
  150 KB, el coste es pequeño; si crece, se limpiará con una tarea programada (huérfanas de más de 30 días).
- **Dos imágenes (portada e icono):** más control del recorte, pero dobla el trabajo de quien solo quiere reconocer su
  proyecto. El icono es la misma imagen recortada al centro.
- **Reutilizar el campo `icon`:** existe en el modelo pero sin uso definido; mezclar una ruta de archivo con un nombre de
  icono confundiría a quien lo use después.

## Consecuencias

- Positivas: los proyectos se reconocen de un vistazo en los tres tamaños, y por fin se editan desde la app.
- Negativas / costes: Storage acumula imágenes que ya no se usan (ver arriba). Sin conexión, la imagen no carga (la URL
  firmada necesita red) y se ve la inicial. El icono es un recorte centrado: una imagen con lo importante en un lado
  puede quedar cortada.
- Relacionado: [ADR-0051](0051-imagenes-en-el-asistente.md) (misma reducción en el navegador),
  [ADR-0054](0054-shell-responsive-en-tres-tamanos.md), [ADR-0019](0019-feedback-con-notificaciones.md),
  `supabase/migrations/20261028120000_project_images.sql`, `packages/core/src/service.ts`,
  `apps/web/src/components/ProjectAvatar.tsx`, `apps/web/src/shell/ProjectDialog.tsx`,
  `apps/web/src/screens/Proyectos.tsx`.
