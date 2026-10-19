# ADR-0016: Iconos Phosphor y fuente Geist autoalojada

- **Estado:** Aceptado
- **Fecha:** 2026-10-19
- **Área:** ui

## Contexto

El autor quiere una librería de iconos cuidada, del estilo de Claude Desktop: trazo fino, consistente y
sobria. La tipografía del diseño es Geist (sans y mono). La app debe funcionar sin conexión (Tauri, PWA)
y con una CSP estricta.

## Decisión

- **Iconos: Phosphor** (`@phosphor-icons/react`). Tiene más de 1.500 iconos, varios grosores (`thin` → `fill`)
  y un estilo de trazo fino muy próximo a Claude Desktop. No podemos confirmar qué librería usa Claude
  Desktop exactamente: se elige por el estilo.
- La app **no importa Phosphor directamente**: usa `icons` / `<Icon name="…" />` de `@muninn/ui`, con nombres
  semánticos (`home`, `projects`, `assistant`, `finance`…). Cambiar de librería es tocar `icons.tsx`.
- Valores por defecto con `<IconDefaults>`: 16 px y grosor `regular`.
- **Fuente: Geist y Geist Mono autoalojadas** con `@fontsource-variable/*` (`@muninn/ui/fonts.css`), sin
  depender de Google Fonts.

## Alternativas consideradas

- **Lucide:** muy buena, pero con un solo grosor. Phosphor permite afinar el peso visual.
- **Tabler / Heroicons:** estilo menos fino o catálogo más corto.
- **Google Fonts por CDN:** no funciona offline y obliga a abrir la CSP.

## Consecuencias

- El catálogo crece añadiendo una línea en `icons.tsx`. La página de desarrollo Fundamentos muestra todos.
- Los iconos de solo decoración llevan `aria-hidden`. Si un icono es el único contenido de un botón, el botón
  necesita `aria-label`.
