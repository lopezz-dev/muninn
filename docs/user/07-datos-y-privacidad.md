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

## Quién puede verlos

- Cada fila de la base de datos pertenece a un usuario, y la propia base de datos impide que nadie
  más la lea o la modifique (*Row Level Security*). No es solo una comprobación de la app.
- Los asistentes de IA solo ven lo que les pides a través de las herramientas de Muninn, y nunca pueden borrar datos.

## Historial de actividad

Muninn guarda un registro de los cambios (qué se creó, movió o completó, y si lo hiciste tú, un
asistente, GitHub o un agente). Sirve para los resúmenes ("¿qué hice esta semana?") y no se puede editar.
