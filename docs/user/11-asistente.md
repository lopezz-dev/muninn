---
title: Asistente
description: Pregunta y pide cosas a Muninn con un modelo que corre en tu ordenador.
order: 11
status: parcial
---

# Asistente

El **Asistente** es Muninn hablando contigo. Le preguntas por tus tareas, notas y finanzas, y también le pides que
haga cosas: crear una tarea, moverla, apuntar un gasto, escribir una nota… Lo encuentras en el menú, en el centro del
dock del móvil y en el buscador (**Ctrl K** o **⌘ K**, escribe tu pregunta y elige **Preguntar a Muninn**).

> **Estado:** la pantalla está lista, pero necesita **Ollama** y un modelo instalados en tu ordenador, y eso todavía no
> está hecho. Mientras, en la **demo** puedes ver cómo funciona con respuestas guionizadas.

## Qué puedes pedirle

- *«¿Cómo voy hoy?»*
- *«Crea una tarea urgente en Muninn para el viernes: revisar el banco de pruebas.»*
- *«Ya he terminado la firma de macOS, márcala como hecha.»*
- *«He gastado 24,90 en el cine.»*
- *«¿Qué suscripciones me cobran esta semana?»*
- *«Apúntame una nota: ideas para el viaje.»*

Llama a las cosas por su nombre (proyectos, columnas, cuentas, categorías) y di los importes en euros, como los
escribirías tú.

## Qué ves en la conversación

- **Las herramientas que ha usado**, como pequeñas etiquetas encima de la respuesta (por ejemplo `overview` o
  `create_task`). Una con ✓ fue bien; con ✗, falló y el asistente lo intentó de otra forma.
- **La respuesta**, que aparece mientras se escribe.
- **Qué ha cambiado**, si ha tocado tus datos, con un enlace para **Abrir** cada cosa y el botón **Deshacer**, que lo
  devuelve todo a como estaba. También te sale un aviso arriba con «Deshacer».

**Nunca borra nada.** Puede crear, editar, mover, completar y archivar. Si le pides borrar, te ofrecerá archivar. Todo
lo que hace queda en el historial de cada tarea como «El asistente».

Solo usa lo que tienes activado en **Ajustes › Módulos**: si Finanzas está desactivado, no tocará tus cuentas y te dirá
que lo actives.

## Dónde funciona

El asistente piensa con un modelo que corre **en tu ordenador** (con Ollama). Así es gratis y privado: lo que le
preguntas no sale de casa.

- **En el ordenador** (la app de escritorio o el navegador): funciona en cuanto Ollama está abierto y tiene el modelo.
- **En el iPhone:** no hay modelo, así que la pantalla te lo dice. Desde el móvil puedes usar Claude con el conector de
  Muninn ([Asistentes de IA](06-asistentes-ia.md)). Lo que el asistente haya cambiado desde el ordenador lo ves igual en
  el móvil.

Si algo falta, la pantalla te dice qué es y cómo arreglarlo:

| Lo que ves | Qué pasa | Qué hacer |
|---|---|---|
| «No encuentro Ollama en este ordenador» | Ollama no está instalado, está cerrado o no acepta a Muninn | Instálalo o ábrelo (ver abajo) y pulsa **Reintentar** |
| «Falta el modelo qwen3:8b» | Ollama está, pero sin ese modelo | `ollama pull qwen3:8b` en una terminal, o elige otro modelo en Ajustes |
| «El asistente usa el modelo de tu ordenador» | Estás en el móvil | Pregúntale desde el ordenador, o usa Claude |

## Instalar Ollama

1. Descarga Ollama de **ollama.com/download** e instálalo. Queda en la bandeja del sistema.
2. Permite que Muninn le hable: añade la variable de entorno `OLLAMA_ORIGINS` (los valores exactos están en la guía
   técnica del repositorio, `docs/gotchas/desktop.md`) y vuelve a abrir Ollama.
3. Descarga el modelo: `ollama pull qwen3:8b` (unos 5 GB).
4. Abre el Asistente: arriba verás **Local · Ollama · qwen3:8b** con un punto verde.

En **Ajustes › Asistente e IA** puedes cambiar la dirección de Ollama (casi nunca hace falta) y el modelo, y pulsar
**Probar conexión**.

## Informe de la mañana

Si lo activas en **Ajustes › Asistente e IA**, cada día a la hora que elijas Muninn te prepara un informe con tus tareas
vencidas, las de hoy y las que tienes en curso, los cobros de los próximos días y el resumen de [Noticias](12-noticias.md).
Se guarda como una **nota fijada** («Informe de la mañana · jueves, 22 oct»), así lo lees en cualquier dispositivo, y sale
arriba en la lista de conversaciones del Asistente.

- Lo prepara **el ordenador** que tenga Muninn abierto a esa hora. Si estaba apagado, lo hace en cuanto abras Muninn ese día y
  te lo dice en la primera línea. Los días que no abras Muninn, no hay informe.
- Las cifras y las tareas salen tal cual de tus datos. Si el modelo está listo, añade arriba una o dos frases con lo más importante.
- **Hacer ahora** prepara uno en el momento, para ver cómo queda.
- Está **desactivado** al principio: crea una nota cada día y eso lo decides tú.

## Tus conversaciones

Se guardan **solo en este dispositivo** (las últimas 30) y se borran al cerrar sesión. No viajan a tu cuenta. Lo que el
asistente cambia, en cambio, sí está en tu cuenta, como cualquier otro cambio.

> **Próximamente:** hablarle con la voz en la app de escritorio (mantener pulsado el micrófono para dictar, y que te conteste en voz
> alta), también en local. En el iPhone podrás escuchar el resumen y el informe con la voz del propio teléfono; para dictar, usa el
> micrófono del teclado.
