---
title: Instalación
description: Instala Muninn en tu ordenador y en tu móvil.
order: 2
status: parcial
group: primeros-pasos
icon: download
---

# Instalación

## Escritorio

Descarga el instalador de tu sistema desde la [página de versiones](https://github.com/lopezz-dev/muninn/releases) (la de
arriba es la más reciente). Está en el apartado **Assets** de cada versión:

| Sistema | Fichero |
|---|---|
| Windows 10 y 11 | `Muninn_x.y.z_x64-setup.exe` |
| macOS (Intel y Apple Silicon) | `Muninn_x.y.z_universal.dmg` |
| Linux | `.AppImage` (portable), `.deb` (Debian/Ubuntu) o `.rpm` (Fedora) |

### Windows

1. Descarga el `-setup.exe` y ábrelo. Se instala solo para tu usuario: no pide permisos de administrador.
2. La primera vez, Windows puede enseñar **«Windows protegió su PC»**, porque el instalador no lleva certificado de Microsoft.
   Pulsa **Más información** y luego **Ejecutar de todas formas**.
3. Abre Muninn desde el menú Inicio.

### macOS

Abre el `.dmg` y arrastra Muninn a **Aplicaciones**. Mientras Muninn no lleve firma de Apple, la primera vez macOS no te
dejará abrirla. En macOS 15 (Sequoia) o superior, intenta abrirla, cierra el aviso y ve a **Ajustes del Sistema › Privacidad y
seguridad**: abajo sale Muninn con el botón **Abrir igualmente**. En versiones anteriores basta con **clic derecho → Abrir**.

### Actualizaciones

No tienes que volver a descargar nada. Cada vez que abres Muninn mira si hay una versión nueva; si la hay, la descarga sin
interrumpirte y te avisa arriba con **Hay una versión nueva · Reiniciar**. Pulsa **Reiniciar** cuando te venga bien: se
instala y Muninn se vuelve a abrir. Si prefieres seguir con lo tuyo, cierra el aviso: te lo volverá a ofrecer la próxima
vez que abras Muninn.

Muninn solo instala versiones firmadas por el proyecto. Sin conexión no comprueba nada y no te molesta. En Linux, las
actualizaciones automáticas funcionan con el `.AppImage`; con `.deb` o `.rpm`, instala la versión nueva a mano.

La versión que tienes aparece arriba en la barra lateral, junto al nombre de Muninn, y en el móvil al pie de **Más**.

## En el navegador

No hace falta instalar nada: abre [muninn-sepia.vercel.app](https://muninn-sepia.vercel.app) en cualquier navegador y entra con tu
cuenta. Es la misma dirección que usas para instalarla en el móvil.

## iPhone

Muninn se instala desde Safari como una app más, sin pasar por la App Store:

1. Abre [muninn-sepia.vercel.app](https://muninn-sepia.vercel.app) en **Safari**.
2. Pulsa el botón **Compartir** (el cuadrado con la flecha).
3. Elige **Añadir a pantalla de inicio**.
4. Abre Muninn desde el icono nuevo, el del cuervo sobre fondo ámbar.

> **Avisos en el móvil:** con Muninn instalada así (iOS 16.4 o superior), activa los avisos en **Ajustes › Notificaciones** para
> enterarte antes de cada cobro. Paso a paso en [Notificaciones](13-notificaciones.md).

## Android

Abre [muninn-sepia.vercel.app](https://muninn-sepia.vercel.app) en Chrome y pulsa **Instalar app** en el menú (⋮).

## Iniciar sesión

Con una cuenta, tus proyectos, tareas y notas se guardan y los ves en todos tus dispositivos. No hay
contraseñas: entras con un código que te llega al correo.

1. Abre Muninn. Si no has entrado, verás la pantalla **Entrar en Muninn**.
2. Escribe tu correo y pulsa **Enviar código**.
3. Abre el correo de Muninn, copia el código y escríbelo en **Código**. Pulsa **Entrar**.

La primera vez, esto crea tu cuenta. El código caduca en una hora. Si no te llega, mira en la carpeta de
correo no deseado o pulsa **Reenviar código** (se puede pedir uno por minuto). Si te equivocaste de
dirección, pulsa **Usar otro correo**.

Usa el mismo correo en el ordenador y en el móvil para ver lo mismo en los dos.

### Con GitHub

En el navegador y en el móvil puedes pulsar **Continuar con GitHub**: te lleva a GitHub para dar permiso y
vuelve a Muninn con la sesión iniciada. Si el botón no aparece, es que aún no está activado.

> **Próximamente:** GitHub en la app de escritorio, y entrar con una **clave de acceso** (Face ID, Touch ID o
> Windows Hello). Mientras tanto, entra con el código por correo.

### Probar sin cuenta

En la pantalla de inicio de sesión, pulsa **Modo demo**. Puedes usar toda la app, pero lo que crees vive en
la memoria del navegador y **se pierde al recargar**. Para salir, ve a **Ajustes › Cuenta** y pulsa
**Salir del modo demo**.

### Cerrar sesión

Ve a **Ajustes › Cuenta** y pulsa **Cerrar sesión**, o busca «cerrar sesión» con **⌘K** / **Ctrl K**. La
sesión se cierra solo en ese dispositivo: tus datos siguen en tu cuenta y en los demás dispositivos sigues
dentro.

Al recargar la página o volver a abrir la app, la sesión se mantiene: no tienes que entrar cada vez.
