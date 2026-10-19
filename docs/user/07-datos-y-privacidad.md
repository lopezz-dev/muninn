---
title: Tus datos y privacidad
description: Dónde se guarda tu información y quién puede verla.
order: 7
status: disponible
---

# Tus datos y privacidad

## Dónde se guardan

- **En la nube (Supabase):** tus proyectos, tareas y notas se guardan en una base de datos Postgres,
  lo que permite sincronizarlos entre dispositivos.
- **Solo en tu equipo:** si usas el asistente sin cuenta, los datos van a un fichero local
  (`~/.muninn/data.json`) y no salen de tu ordenador.
- **Servidor propio:** Muninn está pensado para poder alojarse en tu propio servidor en el futuro.

> **Ahora mismo, en la app:**
>
> - **Con cuenta:** tus datos se guardan en Supabase, en un servidor de la Unión Europea (París). La
>   apariencia (cristal y color de acento) también va con tu cuenta. Lo que cambies en un dispositivo
>   aparece en los demás al recargar; la actualización al momento llegará más adelante.
> - **En modo demo:** lo que creas vive en la memoria del navegador y se pierde al recargar. Solo la
>   apariencia se guarda, en este dispositivo.

## Tu sesión

- Entras con un código que te llega al correo, o con GitHub. Muninn no guarda contraseñas.
- La sesión se guarda en el navegador o en la app de ese dispositivo, para que no tengas que entrar cada
  vez. **Cerrar sesión** (en Ajustes › Cuenta) la borra de ese dispositivo.
- Si entras con GitHub, Muninn solo recibe tu nombre, tu correo y tu foto de perfil, para mostrarlos en la app.
- Al cerrar sesión, la app olvida lo que tenía cargado: nadie que entre después en ese dispositivo con otra
  cuenta verá tus datos.

## Quién puede verlos

- Cada fila de la base de datos pertenece a un usuario, y la propia base de datos impide que nadie
  más la lea o la modifique (*Row Level Security*). No es solo una comprobación de la app.
- Los asistentes de IA solo ven lo que les pides a través de las herramientas de Muninn, y nunca pueden borrar datos.

## Historial de actividad

Muninn guarda un registro de los cambios (qué se creó, movió o completó, y si lo hiciste tú, un
asistente, GitHub o un agente). Sirve para los resúmenes ("¿qué hice esta semana?") y no se puede editar.
