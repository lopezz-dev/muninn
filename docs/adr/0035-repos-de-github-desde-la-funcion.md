# ADR-0035: El selector de repos pide la lista a la Edge Function `github`, con la sesión del dueño

- **Estado:** Aceptado
- **Fecha:** 2026-10-20
- **Área:** core, web

## Contexto

En Ajustes › Integraciones el repo de cada proyecto se escribía a mano (`owner/repo`). Es fácil equivocarse y, peor, nada avisa
si el repo existe pero el token de la sincronización no llega a él: se vincula, y no llega nada. Hace falta un selector con los repos
disponibles. La lista tiene que salir de algún token de GitHub, y el único que tenemos es `GITHUB_TOKEN`, secreto de la función
`github` ([ADR-0031](0031-sync-github-issues-tareas.md)), que no puede salir de ahí.

## Decisión

- La función `github` tiene una tercera ruta, **`GET /github/repos`**, que devuelve los repos a los que llega `GITHUB_TOKEN`
  (`GET /user/repos`), sin los archivados ni los que no tienen issues, ordenados por nombre. Así el selector solo ofrece lo que la
  sincronización puede usar.
- **Autenticación:** la ruta exige la sesión de Supabase del usuario (`Authorization: Bearer <JWT>`), la valida con
  `auth.getUser` y solo responde si es el dueño del despliegue (`MUNINN_USER_ID`). La función sigue desplegada con
  `--no-verify-jwt` porque las otras dos rutas no llevan JWT; cada ruta comprueba lo suyo.
- **CORS:** la llama el navegador, así que la función contesta `OPTIONS` y manda `access-control-allow-origin: *`. No hay cookies:
  sin el JWT, el origen no da acceso a nada.
- **Por dónde pasa:** `m.github.repos()` en el core, que valida la respuesta con zod. El store la ofrece como `githubRepos`
  **opcional**: el de Supabase la pide con `functions.invoke('github/repos')`; los de memoria y fichero no la tienen y el servicio
  devuelve `null`. La lógica (paginar, filtrar, leer el JWT de la cabecera) está en `github-sync.ts`, con tests.
- **En la pantalla:** un `SelectMenu` con «Sin repositorio» y los repos. Los vinculados a otro proyecto salen deshabilitados («en
  Huginn»), y un repo vinculado antes al que el token ya no llega se sigue viendo («sin acceso del token»). Si la lista no está
  (modo demo, error o token sin repos), vuelve el campo de texto de siempre.

## Alternativas consideradas

- **El token de GitHub del login (`provider_token`):** Supabase solo lo da justo al volver de GitHub y no lo renueva, no existe si
  entras por correo y con los permisos por defecto no ve los repos privados. Y listaría repos a los que la sincronización no llega.
- **Guardar la lista en una tabla** que rellene el cron: otra tabla, otra migración y datos viejos durante 5 minutos, para una
  pantalla que se abre de vez en cuando.
- **Una función aparte (`github-repos`) con `verify_jwt`:** la validación del JWT la haría Supabase, pero sería otro despliegue
  y otro empaquetado del core para una sola ruta.
- **Autocompletar sobre el campo de texto:** sigue dejando escribir un repo al que el token no llega, que es el error que queremos evitar.

## Consecuencias

- Elegir un repo ya no tiene erratas, y lo que se elige es exactamente lo que se puede sincronizar.
- Dar acceso al token a otro repo (en GitHub) lo hace aparecer al volver a la pantalla (la lista vive 5 minutos en caché).
- Cada apertura de Integraciones hace una llamada a la función y otra a GitHub; es una pantalla de ajustes, no importa.
- Para varios usuarios (GitHub App, ver ADR-0031) la ruta seguirá igual, pero listará los repos de la instalación del usuario
  de la sesión en lugar de comprobar `MUNINN_USER_ID`.
- Relacionado: [ADR-0031](0031-sync-github-issues-tareas.md), [gotchas/db](../gotchas/db.md#sincronización-con-github-pasos-manuales),
  `packages/core/src/github-sync.ts`, `supabase/functions/github/index.ts`, `apps/web/src/screens/ajustes/Integraciones.tsx`.
