# Gotchas · core (`packages/core`)

### Comparar posiciones con `<`, nunca con `localeCompare`

- **Síntoma:** tarjetas que saltan de orden, sobre todo con claves que mezclan mayúsculas y minúsculas (`a0V` vs `a0b`).
- **Causa:** las claves de fractional-indexing se ordenan por bytes. `localeCompare` usa reglas de idioma.
- **Solución:** usa `byPosition` (`store.ts`) o los operadores `<` y `>`.
- **Ref:** [ADR-0006](../adr/0006-orden-con-fractional-indexing.md)

### `positionAt` puede devolver un `rebalance`, y hay que persistirlo

- **Síntoma:** `generateKeyBetween` lanza una excepción, o el orden queda mal tras sincronizar dos dispositivos.
- **Causa:** dos clientes generaron la misma clave a la vez.
- **Solución:** en el servicio, usa siempre `place()`, que aplica el rebalanceo antes de devolver la
  posición. No llames a `generateKeyBetween` directamente.

### No escribir en el store saltándose el servicio

- **Síntoma:** tareas en "Hecho" sin `completedAt`, falta actividad o hay posiciones duplicadas.
- **Causa:** las reglas viven en `createMuninn`, no en el store.
- **Solución:** la UI, el MCP y las integraciones usan `createMuninn`. El store es un detalle interno.
- **Ref:** [ADR-0002](../adr/0002-api-de-dominio-unica.md)

### Zod 4: `z.uuid()` es estricto

- **Síntoma:** un id "válido" se rechaza en la validación.
- **Causa:** `z.uuid()` valida la variante RFC 4122. Los ids hechos a mano en los tests (`'1'`, `'abc'`) no pasan.
- **Solución:** en los tests, usa ids reales (`crypto.randomUUID()`) o los que devuelve el propio store.

### `z.input` frente a `z.infer` en los tipos de entrada

- **Síntoma:** TypeScript exige campos opcionales al llamar al servicio.
- **Causa:** las entradas con `.optional()`, los defaults o los transforms difieren entre la entrada y la salida.
- **Solución:** los tipos `*Input` se exportan con `z.input<>` y los de consulta con `z.infer<>`. Mantén esa convención.

### "Hoy" depende de la zona horaria

- **Síntoma:** una tarea con fecha de hoy aparece como vencida, o al revés, cerca de medianoche.
- **Causa:** `dueDate` es una fecha local (`AAAA-MM-DD`) y "hoy" se calcula con `timeZone`.
- **Solución:** `createMuninn` acepta `timeZone`. En los tests, fíjala (`'UTC'`) junto con `now`.
  En un servidor (Edge Functions, agentes), pasa la zona del usuario y no la del servidor.

### `file-store` solo funciona en Node

- **Síntoma:** el build de la web falla con `node:fs`.
- **Causa:** importar `@muninn/core/file-store` desde el frontend.
- **Solución:** en la web, importa solo `@muninn/core` y `@muninn/core/supabase`.
- **Ref:** [ADR-0012](../adr/0012-paquetes-internos-como-fuente.md)

### `columns.delete` devuelve los ids movidos, incluidas las archivadas

- Para deshacer un borrado de columna hay que devolver sus tareas al orden que tenían. `delete` devuelve
  `{ movedTaskIds }` en el orden de la columna y mueve también las **archivadas**, que el tablero no ve.
- «Deshacer» recrea la columna con **otro id** (el antiguo ya no existe) y mueve las tareas de vuelta una a una.

### `checklist.counts` trocea las consultas

- **Síntoma:** el tablero de un proyecto con cientos de tareas falla al pedir el progreso de las subtareas.
- **Causa:** `in (…)` de PostgREST va en la URL: con unos cientos de ids se pasa de largo.
- **Solución:** el core lo pide de 100 en 100. Úsalo (`m.checklist.counts(ids)`) y no `checklist.list` por tarea.

### `overview()` incluye las archivadas para contar lo hecho

- `completedToday`, `completedTodayTasks` y `completedByDay` salen de **todas** las tareas del proyecto, archivadas o no.
  Lo abierto (`dueToday`, `overdue`, `upcoming`, `inProgress`, `projects[].open/done`) solo cuenta las no archivadas.

### Notas: la tarea manda sobre el proyecto, y el autoguardado no llena la actividad

- **Vínculos:** si una nota tiene `taskId`, su `projectId` es siempre el de esa tarea (`create` lo deduce y falla si
  le dices otro; `update` lo corrige). Cambiar de proyecto o quitarlo **suelta la tarea** (`taskId: null`).
- **Actividad:** `notes.update` no escribe nada si no cambia ningún campo. Las ediciones de título o texto se anotan como
  mucho una cada 10 minutos por actor (`NOTE_EDIT_WINDOW_MS`); fijar/desfijar tienen sus propias acciones (`pinned`,
  `unpinned`) y vincular se anota siempre. Sin esto, el autoguardado del editor escribiría un evento por pausa al teclear.
- **Ref:** [ADR-0007](../adr/0007-registro-de-actividad.md), [ADR-0026](../adr/0026-markdown-marked-a-react-y-textarea.md)

### GitHub: el estado de una tarea con envío pendiente no lo cambia GitHub

- **Síntoma:** completas una tarea de GitHub y, al editar alguien la issue en GitHub, la tarea no se reabre; o una tarea «no hace caso» a
  una issue reabierta durante unos minutos.
- **Causa:** es intencionado ([ADR-0031](../adr/0031-sync-github-issues-tareas.md)). Mientras haya una entrada sin procesar en
  `githubOutbox` para la tarea, `m.github.applyIssue` solo actualiza título y descripción: el estado de la issue aún no refleja lo de Muninn.
- **Solución:** nada. Si en tests o en otro cliente necesitas el comportamiento de GitHub, vacía la cola antes (`drainGithubOutbox`).
- **Ojo:** la cola solo la llena un actor que no sea `github`. La Edge Function crea el core con `actor: 'github'`: si lo cambiaras, cada
  cambio que llega de GitHub volvería a GitHub.

### La Edge Function lleva el core empaquetado

- **Síntoma:** un cambio del core (reglas de GitHub, el store) no se nota en la sincronización.
- **Causa:** como el MCP, la función usa una copia empaquetada (`supabase/functions/github/_core/muninn.js`, fuera de git), porque Deno no
  resuelve los imports sin extensión del TS fuente.
- **Solución:** `pnpm --filter @muninn/core build:edge` y vuelve a desplegar la función. `@muninn/core/github` solo usa `fetch` y
  `crypto.subtle`: no importes `node:*` desde ahí ni desde lo que importa.

### La columna del agente nunca es la «por defecto»

- **Síntoma:** una issue nueva o una tarea reabierta acaba en «Para el agente» sin etiqueta (o una tarea manual da el error «Solo las
  tareas de GitHub pueden ir al agente» al reabrirla).
- **Causa:** «la primera columna de tipo `todo`» puede ser la del agente si el usuario la puso delante ([ADR-0032](../adr/0032-columna-para-el-agente.md)).
- **Solución:** `defaultColumn` (core) y `reopenTask` (`apps/web/src/lib/task-actions.ts`) se saltan `project.agentColumnId`. Si
  añades otro sitio que elija columna por su tipo, sáltatela también.

### Finanzas: el saldo no se guarda, y los importes del MCP entran en euros

- **Síntoma:** buscas una columna `balance` en `finance_accounts` y no está; o un modelo apunta 2.490 € en vez de 24,90 €.
- **Causa:** el saldo se deriva siempre de los movimientos no archivados ([ADR-0037](../adr/0037-modelo-de-datos-de-finanzas.md)):
  `m.finance.accounts.list()` lo calcula con `store.accountTotals()`. Y los modelos se equivocan al multiplicar por cien.
- **Solución:** no guardes saldos ni los «corrijas» a mano: archiva o edita el movimiento. En el borde (MCP, importaciones), convierte con
  `centsFromEuros` (acepta `24.9`, `'24,90'`, `'1.284,30'`) y muestra con `formatEuros`; dentro del core todo son céntimos.
- **Ojo:** «Ahorro» e «Inversión» no son tipos de movimiento: son traspasos a una cuenta `savings` o `investment`. Los informes los
  sacan del tipo de la cuenta de destino (`accountGroup`).

### Finanzas: las categorías de serie se siembran al leerlas

- `m.finance.categories.list()` crea las de serie si el usuario no tiene **ninguna** (ni archivada). Dentro de una instancia del core las
  llamadas a la vez esperan a la misma siembra; entre dispositivos, el índice único `(owner_id, key)` rechaza las repetidas y el core lo
  ignora. Si en un test cuentas categorías, recuerda que la primera lectura ya trae `DEFAULT_CATEGORIES`.
- Cambiar el tipo de un movimiento quita lo que deja de encajar (la categoría al pasar a traspaso, el destino al dejar de serlo, una
  categoría del otro tipo): `updateTransaction` lo hace solo; no lo repitas en la UI.

### Suscripciones: `charge` con la fecha esperada, y `revert` para deshacer

- **Síntoma:** un cobro apuntado dos veces (dos dispositivos, o un doble clic), o al deshacer «Saltar» la suscripción cambia de día de ciclo.
- **Causa:** `charge` y `skip` adelantan `nextDate`; si se llaman dos veces sobre el mismo cobro, la segunda apuntaría el periodo siguiente.
  Y `update({ nextDate })` mueve también `anchorDate` (elegir otra fecha a mano cambia el ciclo).
- **Solución:** pasa siempre `expected` (la fecha que se ve en pantalla): si ya no es la próxima, `charge`/`skip` fallan con «ya está apuntado
  o saltado». Para deshacer, `revert(id, { previousDate, transactionId })`, que vuelve a la fecha sin tocar el ciclo y archiva el gasto.
  Las fechas siguientes salen de `nextChargeDate(anchor, actual, frecuencia)` (con tests): no sumes meses a mano.
- **Ref:** [ADR-0038](../adr/0038-suscripciones-avisan-y-se-confirman.md)

### Panel mensual: la tasa de ahorro no es «ahorro ÷ ingresos»

- `m.finance.report.month()` define la tasa como (ingresos − gastos) ÷ ingresos ([ADR-0039](../adr/0039-panel-mensual-y-tasa-de-ahorro.md)): no la
  «corrijas» a la cifra de ejemplo del lienzo. Ahorro e inversión salen de los traspasos que cruzan de grupo de cuenta (`totalsOf`).
- Pide los movimientos del primer mes del histórico al último en **una** consulta y reparte en memoria: no llames a `transactions.list`
  por mes.

### El asistente escribe con `withActor`, no con otro store

- **Síntoma:** lo que hace el asistente sale en la actividad como «Tú», o «Deshacer» de un cambio del asistente queda como suyo.
- **Causa:** el actor se fija al crear el core ([ADR-0007](../adr/0007-registro-de-actividad.md)). El asistente necesita el mismo store (la sesión
  del usuario) con actor `assistant` y su contexto ([ADR-0041](../adr/0041-asistente-local-con-catalogo-unico.md)).
- **Solución:** `withActor(app, 'assistant', { activityContext })` devuelve otro core sobre el mismo store; `runAssistant` ya lo hace. Lo que
  devuelve `activityContext()` se guarda en `payload.context` de cada evento (se lee en cada escritura, así que puede cambiar entre
  herramientas). «Deshacer» se ejecuta con el core de la UI (`change.undo(app)`), que es `user`.
- **Ojo:** `withActor` va fuera de `createMuninn` (con un `WeakMap`) porque como método el tipo `Muninn` se referiría a sí mismo. Solo
  funciona con cores creados por `createMuninn`.

### Noticias: `ingest` no deja actividad y `refresh` va fuente a fuente

- `m.news.ingest` (lo usa la Edge Function cada hora) no escribe en `activity`: sería ruido. Las acciones del usuario (fuentes,
  resumen) sí. `m.news.refresh(fetch)` descarga **de una en una**: un feed lento no tumba a los demás y su error queda en `lastError`.
- El lector (`news-feed.ts`) no es un parser XML completo: saca título, enlace, id, fecha, autor y un resumen en texto plano (sin HTML).
  Si un feed real se lee mal, añade su XML como caso en `test/news.test.ts` antes de tocar las expresiones.
- La UI no importa valores del core: lo que necesita (`relatedProjects`) está en `m.news.related`.
- **Ref:** [ADR-0042](../adr/0042-noticias-rss-con-descarga-en-servidor.md)
