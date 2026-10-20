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

- La función `github` tiene una ruta nueva, **`GET /github/repos`**, que devuelve los repos que ve `GITHUB_TOKEN`
  (`GET /user/repos`), sin los archivados ni los que no tienen issues, ordenados por nombre.
- **Los públicos se comprueban al elegirlos.** Todo token, también uno *fine-grained* limitado a unos repos, lee todos los públicos,
  y `/user/repos` los lista aunque el token no pueda escribir en ellos. Un privado que sale sí es del token. Por eso hay una segunda
  ruta, **`GET /github/access?repo=owner/repo`**, que pide crear una issue **sin título**: con permiso GitHub responde 422 (falta el
  título) y sin él 403 o 404; nunca se crea nada. La app la llama solo al elegir un repo público, y si el token no llega avisa y no lo vincula.
- **Autenticación:** las dos rutas exigen la sesión de Supabase del usuario (`Authorization: Bearer <JWT>`), la valida con
  `auth.getUser` y solo responde si es el dueño del despliegue (`MUNINN_USER_ID`). La función sigue desplegada con
  `--no-verify-jwt` porque `/webhook` y `/sync` no llevan JWT; cada ruta comprueba lo suyo.
- **CORS:** la llama el navegador, así que la función contesta `OPTIONS` y manda `access-control-allow-origin: *`. No hay cookies:
  sin el JWT, el origen no da acceso a nada.
- **Por dónde pasa:** `m.github.repos()` y `m.github.canWrite(repo)` en el core, que valida con zod. El store los ofrece como
  `githubRepos` **opcional**: el de Supabase los pide con `functions.invoke`; los de memoria y fichero no los tienen y el servicio
  devuelve `null`. La lógica (paginar, filtrar, comprobar el acceso, leer el JWT de la cabecera) está en `github-sync.ts`, con tests.
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
- **Comprobar todos los públicos al cargar la lista:** la lista saldría exacta, pero con una petición de escritura (fallida a propósito)
  por cada repo público cada vez que se abre la pantalla. Comprobar solo el elegido es una petición, y la pide el usuario.
- **Leer `permissions` de cada repo:** es el permiso del usuario en el repo, no el del token: no distingue los que se le dieron.

## Consecuencias

- Elegir un repo ya no tiene erratas, y no se puede vincular uno al que la sincronización no llega.
- La lista enseña todos los repos públicos de la cuenta, también aquellos a los que el token no llega; se descubre al elegirlos.
- Si GitHub cambiara el orden de sus comprobaciones (validar el cuerpo antes que el permiso), `access` diría que sí a todo: se vería
  al fallar la sincronización (`Edge Functions › github › Logs`).
- Dar acceso al token a otro repo (en GitHub) lo hace aparecer al volver a la pantalla (la lista vive 5 minutos en caché).
- Cada apertura de Integraciones hace una llamada a la función y otra a GitHub, y cada repo público elegido, una más.
- Para varios usuarios (GitHub App, ver ADR-0031) las rutas seguirán igual, pero listarán los repos de la instalación del usuario
  de la sesión en lugar de comprobar `MUNINN_USER_ID`.
- Relacionado: [ADR-0031](0031-sync-github-issues-tareas.md), [gotchas/db](../gotchas/db.md#sincronización-con-github-pasos-manuales),
  `packages/core/src/github-sync.ts`, `supabase/functions/github/index.ts`, `apps/web/src/screens/ajustes/Integraciones.tsx`.
