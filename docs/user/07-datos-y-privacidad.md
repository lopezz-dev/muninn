---
title: Tus datos y privacidad
description: Dónde se guarda tu información y quién puede verla.
order: 7
status: disponible
group: cuenta
icon: shield
---

# Tus datos y privacidad

## Dónde se guardan

- **En la nube (Supabase):** tus proyectos, tareas y notas, tus finanzas (cuentas, movimientos, categorías y suscripciones),
  tus fuentes y artículos de Noticias y tus ajustes se guardan en una base de datos Postgres, lo que permite sincronizarlos
  entre dispositivos.
- **Solo en tu equipo:** las conversaciones con el [Asistente](11-asistente.md) y las imágenes que le enseñas se quedan en ese
  dispositivo y no viajan a tu cuenta (lo que el asistente cambia, sí, como cualquier otro cambio).
- **Solo en tu equipo, sin cuenta:** si conectas Claude u otro asistente **directamente en tu ordenador** sin configurar tu
  cuenta (la opción avanzada de [Conectar Claude y otros](06-asistentes-ia.md#configuración-avanzado)), los datos que maneje van
  a un fichero local (`~/.muninn/data.json`) y no salen de tu ordenador. No son los mismos datos que ves en la app.
- **Servidor propio:** Muninn está pensado para poder alojarse en tu propio servidor en el futuro.

> **Ahora mismo, en la app:**
>
> - **Con cuenta:** tus datos se guardan en Supabase, en un servidor de la Unión Europea (París). La
>   apariencia (cristal y color de acento) y los módulos que tienes activos también van con tu cuenta. Lo que
>   cambies en un dispositivo aparece en los demás al momento, sin recargar.
> - **En modo demo:** lo que creas vive en la memoria del navegador y se pierde al recargar. Solo la
>   apariencia se guarda, en este dispositivo.

## Noticias

Para traerte los artículos nuevos aunque tengas el ordenador apagado, el servidor de Muninn **descarga tus fuentes RSS** cada
hora (y cuando pulsas **Actualizar**). Las webs que sigues ven esa descarga como una visita del servidor, no tuya. El resumen de lo
importante, en cambio, lo hace el modelo de tu ordenador (ver [Noticias](12-noticias.md)).

## Sin conexión

Con cuenta, Muninn guarda **en ese dispositivo** una copia de lo último que viste (proyectos, tareas, notas, finanzas, noticias y
ajustes) para abrir
al instante y poder consultarlo aunque no tengas red. Sin conexión la app es **de solo lectura**: verás el aviso «Sin
conexión · solo lectura» y, si intentas cambiar algo, Muninn te avisa y lo deja como estaba. Al volver la red se actualiza sola.

Esa copia es privada: se borra del dispositivo al **cerrar sesión**, caduca a los 7 días sin abrir la app y solo la puede
recuperar tu cuenta. En modo demo no se guarda nada.

> **Próximamente:** poder crear y editar sin conexión, y que los cambios se envíen al volver la red.

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
