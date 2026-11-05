# ADR-0082: Nombre puesto a mano en cada sesión, guardado con la sesión y recordado por el navegador

- **Estado:** Aceptado
- **Fecha:** 2026-11-05
- **Área:** db, core, web
- **Complementa a:** [ADR-0061](0061-seguridad-de-la-cuenta.md), [ADR-0081](0081-nombre-del-equipo-y-apps-agrupadas-en-sesiones.md)

## Contexto

Con [ADR-0081](0081-nombre-del-equipo-y-apps-agrupadas-en-sesiones.md), la app de escritorio dice el nombre del equipo. En el
navegador eso no se puede: no hay API para leer el nombre del ordenador ni del teléfono, y el *user agent* solo dice el sistema y el
navegador. En la lista real de Alex había cuatro filas «Windows · Chrome» idénticas. Para saber quién es quién hace falta que lo diga
la persona.

- `auth.sessions` no tiene un campo libre y no se toca ([ADR-0061](0061-seguridad-de-la-cuenta.md)).
- Cada vez que entras se abre una sesión nueva con otro `id`; un nombre atado solo a la sesión se pierde al volver a entrar.
- Lo de la cuenta pasa por el core y por funciones `security definer` que solo ven lo de `auth.uid()` y exigen el segundo factor.

## Decisión

- **Tabla `session_names`** (`session_id` → `auth.sessions` con `on delete cascade`, `owner_id`, `name` de 1 a 40 caracteres). RLS
  de lectura para el dueño y `require_mfa`; se escribe solo con **`name_my_session(session_id, name)`**, que comprueba que la sesión es
  tuya (nombre vacío o `null` lo quita). `list_my_sessions` devuelve también `device_name` (migración `20261105150000_nombre_de_sesion`).
- **Cualquier sesión tuya** se puede nombrar desde la lista (lápiz en la fila), no solo la de este dispositivo: así distingues las
  cuatro «Windows · Chrome» sin ir a cada una. La fila enseña el nombre como título y el tipo («Windows · Chrome») en la descripción.
- **El navegador recuerda el de este dispositivo** (`localStorage`, `muninn.deviceName`) y, al arrancar con cuenta, si la sesión de
  ahora no tiene nombre, se lo pone (`restoreDeviceName`). Así sobrevive a volver a entrar sin guardar nada más en el servidor.
- Con «Deshacer», como todo lo que cambia datos.

## Alternativas consideradas

- **Un identificador de dispositivo propio** (generado en el navegador y guardado con la sesión): permitiría reconocer el mismo
  navegador entre sesiones en el servidor, pero lo pone el cliente y se pierde igual al borrar los datos del navegador. Para ponerle
  nombre basta con recordarlo aquí; si el aviso de dispositivo nuevo lo necesita, se añade entonces.
- **Nombre por *user agent* + IP**: la IP cambia a diario y el *user agent* es igual en dos equipos con el mismo navegador.
- **Solo nombrar la sesión de este dispositivo**: obliga a ir a cada equipo para saber cuál es cuál, que es justo lo que no se sabe.

## Consecuencias

- La lista dice lo que tú quieras («Portátil del curro», «iPhone»). Un nombre puesto desde otro dispositivo vale para esa sesión y se
  va al cerrarla; el que pones aquí, además, vuelve solo cuando entras otra vez en este navegador.
- El nombre lo puede cambiar cualquiera con tu sesión abierta y el segundo factor: es una ayuda para reconocer, no una prueba.
- Migración manual en la fase final (4d) y una función más `security definer` ejecutable por `authenticated`.
- Relacionado: `supabase/migrations/20261105150000_nombre_de_sesion.sql`, `packages/core/src/account.ts` (`sessions.rename`),
  `apps/web/src/lib/device-name.ts`, `apps/web/src/screens/ajustes/Seguridad.tsx`, `docs/user/14-cuenta-y-seguridad.md`.
