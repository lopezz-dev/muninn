---
title: Cuenta y seguridad
description: Protege tu cuenta con un segundo factor, cierra la sesión en los dispositivos que ya no uses y quita el acceso a otras apps.
order: 14
status: disponible
group: cuenta
icon: shield
---

# Cuenta y seguridad

Todo esto está en **Ajustes › Cuenta**. Necesitas una cuenta: en el modo demo no sale.

## Activar el segundo factor

El segundo factor es opcional. Con él, para entrar no basta con el código del correo o con GitHub: además, Muninn te
pide un código de seis cifras de una app de tu móvil (Google Authenticator, 1Password, Authy o la que uses). Si alguien
consigue el código de tu correo, sin tu móvil no podrá entrar en la app.

En **Segundo factor**, pulsa **Activar**. Se abre una ventana (en el móvil, desde abajo) con tres pasos:

1. **Escanea:** en tu app de códigos, añade una cuenta nueva y escanea el código QR con la cámara. Si no puedes
   escanearlo, pulsa **Escribe la clave a mano**.
2. **Guarda la clave:** es la misma información que el QR, en letras y números. Pulsa **Copiar clave** y guárdala en un
   sitio seguro (tu gestor de contraseñas, por ejemplo). Si no escaneaste el QR, escríbela en tu app.
3. **Confirma:** escribe el código de seis cifras que te enseña la app. Puedes pegarlo; en el móvil, el teclado te lo
   puede sugerir. En cuanto está completo, Muninn lo comprueba: si no es correcto, se borra para que escribas el que
   sale ahora (cambia cada 30 segundos).

Al acabar verás un check verde: ya está activado. Si cierras la ventana antes de confirmar, no se activa nada; puedes
volver a empezar cuando quieras (con un QR nuevo).

**Guarda la clave de configuración.** Si pierdes el móvil, con ella añades Muninn a la app de otro móvil. Muninn aún no
tiene códigos de recuperación.

## Entrar con el segundo factor

Entra como siempre, con el código del correo o con GitHub. Después, Muninn te pide el código de tu app: escríbelo y
listo. Si te equivocas de cuenta, pulsa **Usar otra cuenta**.

Cada vez que entras en un dispositivo nuevo te lo pide; mientras la sesión siga abierta en ese dispositivo, no.

## Desactivar el segundo factor

Pulsa **Desactivar**: se abre una ventana que te pide el código que sale en ese momento en tu app. Escríbelo y pulsa
**Desactivar**. Desde entonces, para entrar basta con el
código del correo o con GitHub. No se puede deshacer: para volver a activarlo, tendrás que añadir Muninn otra vez a tu
app (con una clave nueva). Puedes borrar la cuenta vieja de Muninn de tu app.

Con el segundo factor activado, el servidor no deja leer ni cambiar tus datos a ninguna sesión que no haya pasado el
código, aunque alguien consiga el del correo.

Las apps que conectes **con el segundo factor ya activado** (como claude.ai) siguen viendo tus datos: al pulsar
**Permitir acceso** ya habías escrito el código al entrar. Si conectaste una app **antes** de activarlo, deja de ver tus
datos: quítale el acceso en **Apps con acceso** (más abajo) y vuelve a conectarla una vez desde esa app. Aunque la
apruebes con el segundo factor, una app conectada no puede ver ni cerrar tus sesiones ni conectar GitHub.

Para **conectar un repositorio de GitHub** a un proyecto necesitas el segundo factor activado, porque Muninn podrá
escribir en él. Si no lo tienes, al vincularlo te lo dirá: actívalo aquí y vuelve a vincularlo. Quitar un repositorio
no lo pide. Las integraciones de finanzas lo pedirán también cuando lleguen.

## Ver dónde tienes la sesión abierta

En **Sesiones y dispositivos** sale cada sitio donde has entrado con tu cuenta: el navegador o la app y el sistema
(«Mac · Chrome», «iPhone · Safari», «Muninn para Windows»), cuándo se usó por última vez y cuándo entraste. La que
lleva la marca **Este** es el dispositivo que tienes delante.

- La app de escritorio sale como «Muninn para Windows» o «Muninn para Mac». Si entraste con una versión anterior, sale como
  el navegador («Windows · Edge», «Mac · Safari») hasta que vuelvas a entrar.
- Las apps que conectaste a tu cuenta salen con su nombre, como «Claude · app conectada» para claude.ai. Para quitarles el
  acceso, usa **Apps con acceso** (más abajo).
- «Programa o servidor» es algo que entra sin navegador, como un script tuyo o el MCP de Muninn en tu ordenador.

Si ves una que no reconoces, ciérrala.

## Cerrar la sesión en otro dispositivo

Pulsa **Cerrar** en su fila. Ese dispositivo saldrá en menos de una hora (lo que tarda en caducar su acceso) y, para
volver, tendrá que entrar de nuevo con el código o con GitHub. No se puede deshacer, pero tampoco borra nada: tus datos
siguen en tu cuenta.

La sesión de este dispositivo no tiene botón ahí: para salir de aquí, usa **Cerrar sesión** (en Acceso).

## Cerrar la sesión en todos a la vez

Al final de la lista, en **Cerrar en otros dispositivos**:

- **En los demás:** sales de todos menos de este. Útil si has perdido el móvil o entraste en un ordenador ajeno.
- **En todos:** sales también de este, y vuelves a la pantalla de entrada.

En los dos casos, los demás dispositivos salen en menos de una hora.

## Quitar el acceso a una app

En **Apps con acceso** salen las apps a las que diste permiso para usar tu cuenta, como claude.ai o Claude Code al conectar
el MCP de Muninn ([Conectar Claude y otros](06-asistentes-ia.md)). De cada una ves desde cuándo tiene acceso, su web y
qué datos de tu perfil puede ver.

Pulsa **Quitar acceso** y esa app deja de poder usar tu cuenta al momento: sus sesiones se cierran. No se puede deshacer
desde aquí; para volver a usarla, conéctala otra vez desde esa app y acepta en la pantalla de autorización de Muninn.
