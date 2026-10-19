# Plantillas de correo de Supabase Auth

Se pegan a mano en el panel: **Authentication › Emails › Templates** (proyecto `muninn`).

| Plantilla en Supabase | Fichero | Asunto |
|---|---|---|
| Magic link | [`acceso.html`](acceso.html) | `{{ .Token }} es tu código de Muninn` |
| Confirm sign up | [`registro.html`](registro.html) | `{{ .Token }} es tu código para crear tu cuenta de Muninn` |

- Solo llevan el **código** (`{{ .Token }}`), sin enlace: el enlace no inicia sesión en la PWA de iPhone ni en
  el escritorio ([ADR-0022](../../docs/adr/0022-auth-y-sesion.md)).
- HTML de correo: tablas y estilos en línea (Gmail y Outlook ignoran casi todo el CSS de `<style>`), sin SVG
  ni imágenes externas, y ancho máximo de 480 px.
- El remitente («Supabase Auth») solo se puede cambiar con un SMTP propio.
