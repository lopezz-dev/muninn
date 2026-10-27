# ADR-0051: Imágenes en el asistente: reducidas en el navegador, solo con modelos con visión y una sola vez

- **Estado:** Aceptado
- **Fecha:** 2026-10-27
- **Área:** web, core

## Contexto

Alex quiere enseñarle imágenes al asistente: la foto de un ticket para apuntar un gasto, una captura para crear una
tarea. El asistente usa un modelo local con Ollama ([ADR-0041](0041-asistente-local-con-catalogo-unico.md)). `/api/chat`
acepta `images` (base64) en los mensajes del usuario, pero solo los modelos con visión las entienden (`gemma3`,
`qwen2.5vl`, `llama3.2-vision`…). El modelo por defecto, `qwen3:8b`, no tiene visión. Una foto del móvil pesa de 4 a 8 MB,
y el historial vive en el IndexedDB del dispositivo.

## Decisión

- **`ChatMessage` del usuario lleva `images?: string[]`** (base64 sin prefijo) en `@muninn/assistant`, y
  `toOllamaMessages` lo pasa tal cual. El proveedor expone `vision?()`: Ollama lo responde con `capabilities` de
  `/api/show`. Un proveedor sin ese método (el guionizado de la demo) no ve imágenes.
- **Se reducen en el navegador** (`lib/assistant-images.ts`): lado mayor de 1568 px y JPEG al 85 %, con fondo blanco
  para las transparencias. Una captura de 3,6 MB queda en unos 50 KB. Como mucho, **4 por mensaje**.
- **Solo viajan una vez:** al modelo le llegan en el mensaje en que se adjuntan. El historial que se le manda en los turnos
  siguientes (`historyFor`) es solo texto. El turno guarda las imágenes reducidas (`Turn.images`) para enseñarlas en la
  conversación, en este dispositivo, como el resto del historial.
- **Sin visión, no se mandan:** la caja de escribir avisa (««qwen3:8b» no ve imágenes…», con los modelos que sí) y
  desactiva Enviar mientras haya imágenes adjuntas. No se quitan sin avisar ni se manda el texto solo.
- Se adjuntan con el clip, arrastrándolas a la caja o pegándolas. Una imagen sin texto se pregunta como «¿Qué ves en
  la imagen?».

## Alternativas consideradas

- **Reenviar las imágenes en cada turno:** el modelo las «recordaría», pero cada pregunta tardaría más y el contexto
  se llenaría pronto con un modelo local. Si hace falta, el usuario las adjunta otra vez.
- **Subirlas a Supabase Storage:** permitiría verlas desde el móvil, pero el historial del asistente es local a
  propósito (ADR-0041) y las imágenes suelen ser privadas (tickets, documentos).
- **Mandarlas aunque el modelo no tenga visión:** Ollama las ignora en silencio y el modelo contestaría como si no
  hubiera imagen. Es mejor decirlo.

## Consecuencias

- Positivas: «apunta este ticket» funciona con un modelo con visión, sin coste y sin que la imagen salga del ordenador.
- Negativas / costes: hay que instalar un modelo con visión además del de herramientas, o uno que haga las dos cosas
  (`gemma3` y `qwen2.5vl` llaman herramientas). Falta probarlo con un modelo real: va en la fase final. El historial
  del dispositivo crece unos 50–300 KB por imagen (sigue el tope de 30 conversaciones).
- Relacionado: `packages/assistant/src/provider.ts`, `providers/ollama.ts`, `apps/web/src/lib/assistant-images.ts`,
  `apps/web/src/lib/assistant-chat.ts`, `apps/web/src/screens/Asistente.tsx`.
