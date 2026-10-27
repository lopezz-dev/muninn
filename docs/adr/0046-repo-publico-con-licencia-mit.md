# ADR-0046: El repositorio es público, con licencia MIT y política de seguridad

- **Estado:** Aceptado
- **Fecha:** 2026-10-27
- **Área:** ci, docs
- **Reemplaza a:** la parte de [ADR-0010](0010-ramas-y-releases.md) que daba por hecho un repositorio privado

## Contexto

`lopezz-dev/muninn` nació privado por prudencia: Muninn guarda finanzas, notas y tareas de quien lo usa. Pero la idea es ofrecerlo
a otras personas, y un repo privado tiene costes concretos:

- La app de escritorio no puede actualizarse sola: las releases privadas no se descargan sin token (ADR-0010).
- Los minutos de macOS cuentan ×10 en GitHub Actions.
- Quien vaya a confiarle sus datos no puede revisar cómo se tratan.

La seguridad de los datos no depende del código: la web publicada ya entrega todo el frontend a cualquiera. Depende de RLS en
Postgres ([ADR-0004](0004-multiusuario-con-rls.md)) y de que ninguna clave de servidor viaje al cliente. Antes de decidirlo se
revisó el historial completo (148 commits, todas las ramas) y no había secretos: solo la clave *publicable* de ejemplo y correos.

## Decisión

- El repositorio pasa a **público**, como `lopezz-dev/huginnDB`.
- Licencia **MIT** (`LICENSE`, `"license"` en el `package.json` raíz y en el bundle de Tauri).
- **`SECURITY.md`** en la raíz: cómo avisar de una vulnerabilidad (`contact@shion.es`, sin issues públicas), qué protege los
  datos y qué no hace todavía (no hay cifrado de extremo a extremo).
- Las capturas de pruebas (`.playwright-mcp/`) se sacan del repo: estaban ignoradas pero se colaron en un commit.
- Cambiar la visibilidad es un paso manual del dueño ([fase final](../fase-final.md)).

## Alternativas consideradas

- **Seguir privado con un repo público solo de binarios:** resuelve el actualizador, pero con otro repo y un token con permiso de
  escritura en CI. No aporta seguridad: los binarios llevan el mismo frontend que la web.
- **Seguir privado con una Edge Function que sirva las actualizaciones con la sesión:** nada público, pero otra pieza que desplegar,
  y el actualizador solo funcionaría con sesión iniciada.
- **AGPL u otra licencia con *copyleft*:** obligaría a quien lo ofrezca como servicio a publicar sus cambios. Se elige MIT, como en
  huginnDB; si la comercialización lo pide, se puede cambiar para versiones futuras.

## Consecuencias

- El actualizador de escritorio lee las releases del propio repo ([ADR-0047](0047-actualizaciones-de-escritorio-firmadas.md)).
- Las Actions de un repo público no gastan minutos, también las de macOS.
- Todo el historial queda a la vista, también los correos de autor de los commits y las ramas `claude/*`.
- Ningún secreto puede entrar en el repo: van en secretos de GitHub, de Supabase o en `.env.local` (ignorado). Conviene activar
  *secret scanning* y *push protection* al hacerlo público.
- MIT permite que cualquiera use, modifique y venda Muninn.
