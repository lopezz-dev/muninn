# ADR-0044: Voz en local: Whisper (whisper.cpp) para dictar y Piper para hablar, como procesos aparte en el escritorio

- **Estado:** Propuesto
- **Fecha:** 2026-10-26
- **Área:** desktop, web
- **Relacionado:** [ADR-0041](0041-asistente-local-con-catalogo-unico.md), [ADR-0008](0008-tauri-escritorio-pwa-movil.md)

## Contexto

La F4 quiere hablarle al asistente («mantener para hablar», M-Asistente.dc.html) y que conteste o lea el resumen de noticias en voz alta
(«Escuchar» en Noticias.dc.html), **todo en local**, como el modelo (ADR-0041). Equipo: Windows 11, RTX 5070 (12 GB, con el modelo de
lenguaje ya ocupando ~6–9 GB), 32 GB de RAM. Hoy no hay Python ni Docker instalados (gotchas/tooling) y no se instala nada en esta fase.
En el iPhone no hay procesos locales ni modelo.

## Decisión (propuesta)

**1. Dictado (STT): whisper.cpp, con su servidor HTTP (`whisper-server`).**
- Binario precompilado de las *releases* (v1.9.5 el 26-10-2026): `whisper-bin-win-cuda-12.4.0-x64.zip` (GPU) o `whisper-bin-x64.zip` (CPU).
  Sin Python ni compilar.
- Modelo recomendado: **`ggml-large-v3-turbo-q5_0.bin` (574 MB)**, buen español y rápido; si va justo de VRAM o en CPU, **`ggml-small.bin`
  (488 MB)**. Comprobado en `huggingface.co/ggerganov/whisper.cpp`. Los modelos viven **fuera del repo** (`%USERPROFILE%\.muninn\voz\`).
- Corre como **proceso aparte** en `127.0.0.1:8178` (`whisper-server -m … -l es --host 127.0.0.1 --port 8178`); la app le manda el audio a
  `POST /inference` (`multipart/form-data`, campo `file`, `response_format=json`).
- **Audio:** la app graba con `getUserMedia` y lo convierte a **WAV mono de 16 kHz** en el navegador (así `whisper-server` no necesita
  ffmpeg). Mientras se mantiene pulsado el botón del micrófono se graba; al soltar, se transcribe y el texto queda **en el campo, sin enviar**
  (el diseño enseña «Cancelar» y «Enviar»): nada se ejecuta por un error de transcripción.

**2. Voz (TTS): Piper, con su servidor HTTP.**
- `piper-tts[http]` (GPL-3.0; se usa como programa aparte, no se enlaza con Muninn) y la voz **`es_ES-davefx-medium`** (carpeta de ~63 MB en
  `rhasspy/piper-voices`; hay otras: `sharvard`, `carlfm`, `mls_*`). Arranca con `python -m piper.http_server -m es_ES-davefx-medium --port
  5002` y responde WAV a `POST /synthesize` con `{ "text": … }`. Rápido en CPU: no compite por la VRAM con el modelo.
- Necesita **Python** (3.10 o posterior), que hoy no está: es lo que más cuesta instalar, por eso es propuesta.
- **Kokoro (82M)** como alternativa: suena más natural y tiene voces en español (`ef_dora`, `em_alex`, `em_santa`, código `e`), pero también
  es Python, depende de espeak-ng y sus voces en español son pocas. Se puede cambiar después: la app solo ve «un servidor que devuelve WAV».

**3. Integración en Tauri: la app de escritorio, no el navegador.**
- Los dos servicios **los arranca el usuario** al principio (acceso directo o tarea al iniciar sesión; pasos en gotchas/desktop). Más adelante,
  Tauri podrá lanzarlos como **sidecars** (`externalBin`) al abrir Muninn y pararlos al cerrar; eso añade binarios de cientos de MB al
  instalador, así que se decide aparte.
- La app de escritorio les habla por `localhost` (la CSP ya admite `http://localhost:*`). Como ninguno de los dos manda cabeceras CORS, las
  llamadas se hacen desde **Rust** (dos comandos de Tauri, `voice_transcribe` y `voice_speak`) y no con `fetch` del webview. En el navegador
  del ordenador (`pnpm dev`) la voz no se ofrece.
- Ajustes › Asistente e IA › **Voz**: interruptor, direcciones de los dos servicios y «Probar»; mismo patrón de estados que el asistente
  («No encuentro el dictado en este ordenador», con los pasos).

**4. Web y iPhone.**
- **Dictar:** nada propio. La Web Speech API (`webkitSpeechRecognition`) de Safari manda el audio a Apple, contra «todo local». El
  dictado del teclado de iOS ya existe para quien lo quiera, y la pantalla lo dice.
- **Escuchar:** sí, con `speechSynthesis` del navegador: en iPhone las voces del sistema funcionan en el propio dispositivo. Sirve para
  «Escuchar» el resumen de noticias y el informe de la mañana también en el móvil; en el escritorio, Piper si está y si no `speechSynthesis`.

## Alternativas consideradas

- **Whisper en Python (`faster-whisper`, `openai-whisper`):** más Python y CUDA/cuDNN que instalar; whisper.cpp trae binarios para Windows.
- **Whisper dentro del navegador (WebGPU/WASM, transformers.js):** sin instalar nada, pero descarga cientos de MB al webview, usa la misma GPU
  que Ollama y engorda la app; para más adelante si hiciera falta en el iPhone.
- **Proxy en Node** en lugar de comandos de Rust: otro proceso; Tauri ya puede hacer la petición.
- **Web Speech API para dictar:** no es local (ver arriba).
- **TTS del sistema (SAPI de Windows) en el escritorio:** sin instalar, pero las voces en español de Windows suenan peor que Piper; queda como
  respaldo (es lo que usa `speechSynthesis` en Tauri).

## Consecuencias

- Hasta que se instale (fase final), no hay botón de micrófono: el diseño lo muestra, la app no.
- Con la RTX 5070, la build de CUDA 12.4 de whisper.cpp podría no traer código para la arquitectura nueva (Blackwell): si falla, CPU con
  `ggml-small.bin`, o compilar con CUDA 12.8+ (gotchas/desktop).
- La GPU la comparten Ollama y Whisper: con un 14B y large-v3-turbo a la vez, puede no caber; con `qwen3:8b` sí.
- Piper es GPL-3.0: se usa como servicio aparte que el usuario instala; si un día se empaqueta con Muninn (sidecar) habrá que revisar la licencia.
- Implementarlo pide: los dos comandos de Tauri, la grabación a WAV en el navegador, el botón de mantener (ratón, tacto y teclado) y los estados.
