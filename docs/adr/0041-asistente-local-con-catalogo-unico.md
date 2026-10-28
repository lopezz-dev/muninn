# ADR-0041: Asistente con modelo local (Ollama) que corre en la app, con un catálogo único de herramientas compartido con el MCP

- **Estado:** Aceptado
- **Fecha:** 2026-10-22
- **Área:** core, mcp, desktop, web
- **Complementa a:** [ADR-0009](0009-mcp-stdio-sin-borrados.md), [ADR-0007](0007-registro-de-actividad.md), [ADR-0028](0028-modulos-activables-solo-en-la-interfaz.md)

## Contexto

La F4 («Jarvis») pide un asistente dentro de Muninn que conozca y gestione los datos con un modelo **local**: el
ordenador del usuario (Windows 11, RTX 5070 con 12 GB de VRAM, 32 GB de RAM) con Ollama. Hoy:

- El MCP (stdio y remoto) ya expone tareas, notas y finanzas sin borrados, con resolución por nombre e importes en euros
  (ADR-0009, ADR-0033). Esas reglas están escritas dentro de `packages/mcp`, pegadas al SDK de MCP.
- La app corre en Tauri (escritorio) y como PWA (iPhone). El core se carga en diferido en el navegador con la sesión del
  usuario y RLS (ADR-0020, ADR-0022).
- En el iPhone no hay modelo local, y la PWA (HTTPS) no puede hablar con un `http://` de la red de casa.
- Todo lo que se cambie tiene que quedar en la actividad con su actor (ADR-0007) y ofrecer «Deshacer» (ADR-0019).

## Decisión

**1. Dónde corre: en la propia app, en el ordenador donde está Ollama.**
- El bucle de herramientas corre **en la app** (Tauri o el navegador del mismo ordenador), con el core que ya tiene cargado
  la sesión del usuario: RLS sigue mandando y no hay ningún servicio nuevo que arrancar. La app habla directamente con la
  API local de Ollama (`http://localhost:11434`, `/api/tags` y `/api/chat` en streaming NDJSON). La CSP de Tauri ya admite
  `http://localhost:*`; los orígenes que Ollama acepta se configuran con `OLLAMA_ORIGINS` (pasos en gotchas/desktop).
- **En el iPhone** (o cualquier equipo sin Ollama) la pantalla lo dice tal cual: «El asistente usa el modelo de tu
  ordenador», con lo que sí funciona desde ahí (Claude con el MCP remoto, ADR-0033) y el historial de lo que hizo el
  asistente en la actividad. No se intenta llegar al ordenador por la red ni se publica nada para «arreglarlo».
- **Proveedor en la nube:** queda como alternativa **opcional y nunca por defecto** (la interfaz lo permite: un
  `ChatProvider` más, con la clave del usuario guardada en su equipo). No se implementa en esta fase.

**2. Un catálogo único de herramientas: paquete nuevo `@muninn/assistant`.**
- `packages/assistant/src/tools` define cada herramienta una vez: nombre, título, descripción, **forma zod** (con los enums
  del core), si lee o escribe, a qué módulo pertenece y su `run(ctx, args)` sobre el core. Lo usan **el MCP** (que solo
  registra el catálogo en el SDK: `packages/mcp/src/server.ts`) y **el asistente** (que lo pasa a JSON Schema con
  `z.toJSONSchema`). Las reglas son las de siempre: sin borrados definitivos (como mucho archivar), resolución por nombre,
  importes en euros (`centsFromEuros`) y errores esperables devueltos como texto.
- Cada escritura anota su **cambio con la inversa** (`ctx.changed({ summary, undo, target })`): el MCP lo ignora; el
  asistente lo enseña con «Deshacer», que se ejecuta con el core del **usuario** (en la actividad consta `user`).
- El asistente solo ofrece las herramientas de los **módulos activos** (`toolsFor(enabledModules)`), como anticipaba
  ADR-0028; el MCP sigue exponiendo todo.
- Por qué un paquete y no el core: el catálogo es «cómo habla un modelo con Muninn», no reglas de dominio, y no debe arrastrar
  el SDK de MCP a la web. Sigue ADR-0012: TS fuente, sin compilar; el MCP lo empaqueta (`noExternal`) en `dist/index.js` y en
  el paquete de la Edge Function `mcp`.

**3. El bucle (`runAssistant`).**
- Varios pasos: el modelo pide herramientas, se ejecutan **de una en una** (las dependientes no se adelantan) y su resultado
  vuelve al modelo, hasta que contesta con texto. Como mucho **6 vueltas** y **6 llamadas por vuelta**; al llegar al máximo, una
  última vuelta **sin herramientas** le obliga a contestar.
- Los errores (validación, no encontrado, herramienta inexistente, argumentos mal formados) vuelven al modelo como texto
  para que se corrija, igual que `run` del MCP. Los modelos pequeños mandan `null` o `""` en lo opcional: se reintenta sin ellos.
  Un error inesperado (red, Ollama) corta el turno y se enseña.
- **Nada destructivo:** el catálogo no tiene borrados, y una misma escritura repetida en un turno no se ejecuta dos veces.
- Cada resultado se recorta (8.000 caracteres) para no llenar el contexto; el historial que se manda de turnos anteriores es
  solo texto (sin las llamadas), por la misma razón.
- Instrucciones cortas en español con la fecha de hoy y los próximos siete días (los modelos pequeños cuentan mal «el viernes»).

**4. Actividad: actor nuevo `assistant`.**
- Migración aditiva `20261022120000_assistant_actor` (`alter type actor_kind add value 'assistant'`). `mcp` sigue siendo un
  cliente externo (Claude, Codex…); `assistant`, el de la app. Las tareas que crea llevan `source = 'mcp'` (en la app ya se
  llaman «Asistente»): no hace falta otro valor de `task_source`.
- `payload.context = { conversation, tool }` en cada evento, con la opción nueva `activityContext` del core. El asistente usa
  una copia del core con otro actor sobre el mismo store: `withActor(app, 'assistant', { activityContext })`.

**5. Proveedores: una interfaz `ChatProvider` (`status()` y `chat()` en streaming).**
- `createOllamaProvider` (por defecto `qwen3:8b`, `num_ctx` 16384 porque el catálogo no cabe en los 4096 de serie, `think: false`
  para responder antes, `keep_alive` 10 min) y `createScriptedProvider` (respuestas guionizadas por reglas) para los tests, el
  banco de pruebas y la **demo**. `status()` distingue «listo», «sin modelo descargado» y «apagado» para que la UI diga qué hacer.

**6. Modelos candidatos** (comprobados en ollama.com el 22-10-2026; tamaños de la cuantización Q4_K_M por defecto):

| Modelo | Descarga | Contexto | Por qué |
|---|---|---|---|
| **`qwen3:8b`** (por defecto) | 5,2 GB | 40K | Herramientas y razonamiento, buen español; con 16K de contexto deja VRAM de sobra |
| `qwen3:14b` | 9,3 GB | 40K | Más fiable en llamadas encadenadas; cabe en 12 GB, pero justo con 16K de contexto |
| `llama3.1:8b` | 4,9 GB | 128K | Alternativa con herramientas, más floja en español |

El **banco de pruebas** (`packages/assistant/bench`: «¿Cómo voy hoy?», «Crea una tarea urgente en Muninn para el viernes…»,
«He gastado 24,90 en el cine», «¿Qué suscripciones me cobran esta semana?», borrar que no borra…) dice qué debería llamar el
modelo y cómo deben quedar los datos. Con el proveedor guionizado (el «modelo perfecto») corre en `pnpm test`; contra Ollama,
`pnpm --filter @muninn/assistant bench -- --model qwen3:8b` (fase final). El modelo por defecto se confirma o se cambia con su resultado.

**7. Historial de conversaciones: en el dispositivo.**
- Las conversaciones se guardan en el **IndexedDB del dispositivo** (las últimas 30), no en Supabase: son una herramienta de
  trabajo, no un dato de la cuenta, y solo hay modelo en un equipo. Lo que el asistente **cambia** queda en la actividad (en la
  nube, con su conversación) y lo que **produce** para leer en otro sitio (informes, resumen de noticias) va a datos de la
  cuenta (ADR siguientes). Si un día hace falta el historial en varios dispositivos, tabla nueva con RLS y otro ADR.

## Alternativas consideradas

- **Servicio local aparte** (el binario del MCP con un endpoint de chat, o un proceso de Tauri en Rust): otra pieza que arrancar y
  mantener, y con la *service role* en local (stdio) en vez de la sesión del usuario. La app ya tiene el core y la sesión.
- **Que la Edge Function hable con Ollama:** el modelo está en casa; habría que abrir un túnel a internet.
- **Que el asistente use el MCP** (cliente MCP dentro de la app hablando con el servidor local o remoto): una capa de protocolo
  más para llamar a funciones que ya están en el mismo proceso, y sin «Deshacer».
- **Duplicar las herramientas** en la app: divergirían en descripciones y reglas en el primer cambio.
- **Catálogo dentro del core** (`@muninn/core/tools`): mezcla dominio con la forma de hablar con un modelo; un paquete aparte deja
  el core igual para la UI y las Edge Functions.
- **Historial en Supabase desde ya:** migración, RLS, tiempo real y caché para algo que solo se usa en un equipo; se puede añadir.
- **Proveedor en la nube por defecto:** el requisito es que todo sea local; queda como opción.

## Consecuencias

- Las herramientas nuevas se escriben una vez en `@muninn/assistant/tools` y salen en el MCP y en el asistente. **Tras cambiarlas,
  recompila el MCP** (`build` y `build:edge`) y redespliega la función `mcp` (paso de la fase final).
- El asistente solo funciona en el ordenador con Ollama; en el iPhone la pantalla lo explica. Sin modelo, la demo usa el guion.
- Cada turno puede tardar varios segundos con un modelo local; el streaming y los chips de herramientas lo hacen llevadero.
- El catálogo completo ocupa unos miles de tokens: si crece mucho, habrá que agrupar herramientas o elegirlas por módulo/intención.
- Relacionado: [gotchas/core](../gotchas/core.md), [gotchas/mcp](../gotchas/mcp.md), [gotchas/desktop](../gotchas/desktop.md),
  `packages/assistant`, `packages/mcp/src/server.ts`, migración `20261022120000_assistant_actor`.
