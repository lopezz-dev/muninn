# ADR-0029: Tiempo real por invalidación de caché y caché de solo lectura sin conexión

- **Estado:** Aceptado
- **Fecha:** 2026-10-19
- **Área:** web, db

## Contexto

Muninn se usa desde varios dispositivos (escritorio, iPhone). Lo que se cambia en uno debe verse en los demás sin
recargar, y la PWA debería abrir y mostrar datos sin red. Hay que hacerlo sin pisar las escrituras optimistas
([ADR-0025](0025-escrituras-optimistas-y-deshacer.md)) y sin engordar el JS inicial ([ADR-0020](0020-tanstack-router-carga-diferida.md)).

## Decisión

**Tiempo real**
- Un canal de Supabase Realtime por usuario (`lib/sync.ts`) con `postgres_changes` en las seis tablas publicadas: `projects`,
  `board_columns`, `tasks`, `task_checklist_items`, `notes` y `user_settings` (esta última, por la migración
  `20261019150000_realtime_user_settings`). RLS ya filtra por dueño. El evento **no trae datos a la UI**: invalida la
  parte de la caché de react-query a la que afecta y la pantalla vuelve a pedir lo suyo.
- Los cambios que llegan seguidos se agrupan (400 ms). **No se refresca nada que tenga escrituras propias en cola**
  (`isBusy`, la cola serializada de `mutations.ts`: por proyecto, por nota o `settings`): se espera a que se vacíe. Así los
  eventos de los propios movimientos no pisan lo optimista; cuando llegan, el refresco devuelve lo que ya se ve.
- Al reconectar tras un corte se repone todo (se pudieron perder eventos), también esperando a que no haya escrituras en vuelo.

**Sin conexión**
- La caché de react-query se guarda en IndexedDB (`lib/offline.ts`, `idb-keyval` + `persistQueryClient`), con clave por
  usuario, como mucho cada 1,5 s, solo lo leído con éxito, con caducidad de 7 días y un número de versión (`CACHE_VERSION`:
  súbelo si cambia la forma de lo guardado). Se recupera en el loader de `_app`, antes del primer pintado, con un máximo de 2 s de espera.
- Sin red, **solo lectura**: las escrituras fallan, se deshacen y avisan «Sin conexión». Un aviso («Sin conexión · solo lectura»)
  sale mientras no haya red. No hay cola de escrituras pendientes.
- Es información privada del dispositivo: se borra al cerrar sesión y al cambiar de usuario (`forgetUserData`).
- Todo va en chunks diferidos (`lib/sync.ts`, `lib/offline.ts`, el aviso): `query-persist-client-core` y la hidratación de
  `query-core` se sacan del grupo `tanstack` de `vite.config.ts` para que no viajen en el arranque.

## Alternativas consideradas

- **Suscripción por canal de proyecto:** los elementos de checklist no tienen `project_id` (no se pueden filtrar en servidor), Inicio y
  Notas necesitan la suya y hay que abrir y cerrar canales al navegar, para ahorrar poco con un usuario por cuenta.
- **Aplicar el contenido del evento a la caché** en lugar de invalidar: más rápido, pero hay que replicar en el cliente el
  cálculo del servidor (claves de orden, `completedAt`) y resolver el orden de los eventos. Invalidar es robusto y suficiente.
- **Ignorar los eventos propios** por identificador de cliente: Realtime no lo da; habría que añadir una columna.
- **Lectura y escritura sin conexión (cola de mutaciones):** coste alto (orden con fractional indexing contra cambios de otros
  dispositivos, conflictos, «Deshacer» sobre operaciones pendientes, ids provisionales). Queda en el ROADMAP para F2/F3 y pedirá su ADR.
- **Service worker con caché de API:** el de la PWA solo guarda la aplicación; los datos van en la capa de datos, también en Tauri.

## Consecuencias

- Cada cambio ajeno cuesta una petición de lectura de la pantalla afectada (con un usuario, es poco).
- Si dos dispositivos editan a la vez la misma nota, gana el último guardado; el editor no pisa lo que se está escribiendo (ver gotchas/web).
- `activity` no está en la publicación: el historial de una tarea se actualiza al refrescar sus datos.
- Un borrado trae solo la clave: sin `project_id`, se refrescan todos los tableros.
- Relacionado: [gotchas/web](../gotchas/web.md), [gotchas/db](../gotchas/db.md), `lib/sync.ts`, `lib/offline.ts`.
