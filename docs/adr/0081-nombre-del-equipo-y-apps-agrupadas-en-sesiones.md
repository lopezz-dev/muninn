# ADR-0081: La app de escritorio dice el nombre del equipo y las sesiones de cada app conectada van en una fila

- **Estado:** Aceptado
- **Fecha:** 2026-11-05
- **Área:** desktop, core, web
- **Complementa a:** [ADR-0061](0061-seguridad-de-la-cuenta.md)

## Contexto

La lista «Sesiones y dispositivos» ([ADR-0061](0061-seguridad-de-la-cuenta.md)) solo sabe el tipo de dispositivo, que saca del
*user agent*: «Windows · Chrome», «Muninn para Windows», «Claude · app conectada». Con el uso real, Alex no sabe cuál es cuál:
hay varias filas «Windows · Chrome» iguales y una fila por cada vez que claude.ai o Claude Code se reconectan. Sin saber quién es
quién, la lista no sirve para cerrar lo que no reconoces, y avisar de «dispositivos nuevos» (PR #132) tampoco tiene sentido.

- Supabase guarda el *user agent* de cada sesión al entrar; no hay otro campo libre en `auth.sessions`.
- La app de escritorio ya añade `Muninn/<versión>` al *user agent* del webview desde Rust (WebView2 en Windows, WKWebView en macOS).
- Un navegador no deja leer el nombre del equipo. Eso queda para un nombre puesto a mano, aparte.

## Decisión

- **Escritorio:** la marca pasa a ser `Muninn/<versión> (<nombre del equipo>)`. En Windows, `COMPUTERNAME`; en macOS, el «Nombre del
  ordenador» (`scutil --get ComputerName`). Se limpia en Rust (letras, números, espacios y `-_.'`, sin `.local`, 40 caracteres como
  mucho). `sessionDeviceLabel` lo lee y la fila dice «PC-ALEX · Muninn para Windows». Sin tablas ni migraciones: va en el mismo dato
  que Supabase ya guarda.
- **Apps conectadas:** `groupSessions` (core) separa tus dispositivos de las sesiones abiertas por OAuth y junta estas en **una fila
  por app**, con cuántas son y la última actividad. «Cerrar todas» las cierra una a una; para que la app no vuelva a entrar está
  «Quitar acceso» en Apps con acceso, y el aviso lo dice.

## Alternativas consideradas

- **Una tabla con el nombre por sesión, escrita por la app tras entrar** (como `push_subscriptions.session_id`, [ADR-0074](0074-avisos-push-atados-a-la-sesion.md)):
  sirve también para el navegador (nombre puesto a mano) y es el siguiente paso, pero para el escritorio es más pieza de la que hace
  falta: el *user agent* ya llega al servidor en el momento de entrar.
- **El nombre de red (`hostname`) en macOS:** suele ser `MacBook-Pro-3.local`; el «Nombre del ordenador» es el que la persona eligió.
- **Ocultar las sesiones de apps:** esconde justo lo que interesa ver si alguien conecta una app sin que lo sepas.

## Consecuencias

- Las sesiones de escritorio abiertas **desde esta versión** salen con el nombre del equipo. Las de antes siguen como «Muninn para
  Windows» hasta que se vuelva a entrar.
- El nombre del equipo viaja en el *user agent* de cada petición del webview: a Supabase y a lo que cargue la app (su propio origen).
  Es un dato que tú pusiste al equipo, no un identificador oculto. Si no se puede leer, la marca se queda sin él.
- Linux no tiene la marca todavía (tampoco antes): sale como navegador.
- Sigue pendiente el navegador: un nombre puesto a mano para la sesión de este dispositivo (tarea «Seguridad: flecos…»).
- Relacionado: `apps/desktop/src-tauri/src/lib.rs` (`device_name`, `user_agent_mark`), `packages/core/src/account.ts`
  (`sessionDeviceLabel`, `groupSessions`), `apps/web/src/screens/ajustes/Seguridad.tsx`, `docs/user/14-cuenta-y-seguridad.md`.
