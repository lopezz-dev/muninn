# ADR-0017: Componentes base sobre Radix, con variantes cva y `cn()` (tailwind-merge)

- **Estado:** Aceptado
- **Fecha:** 2026-10-19
- **Área:** ui

## Contexto

Las pantallas necesitan diálogos, paneles laterales, hojas inferiores, menús, tooltips, interruptores,
casillas y selectores segmentados. Hacerlos accesibles a mano (foco atrapado, Escape, roles ARIA, navegación
con teclado, portales) es mucho trabajo y fácil de hacer mal.

## Decisión

- **Primitivas de Radix UI** (paquete unificado `radix-ui`) para todo lo interactivo complejo: `Dialog` (también
  `SheetContent`, lateral o inferior), `DropdownMenu`, `Tooltip`, `Switch`, `Checkbox` y `ToggleGroup` (para
  `SegmentedControl`). Radix aporta el comportamiento y nosotros todo el estilo, con los tokens.
- **Variantes con `class-variance-authority`** (`buttonVariants`, `chipVariants`), exportadas para reutilizarlas.
- **`cn()`** = `clsx` + `tailwind-merge`, configurado con nuestros tokens propios (`rounded-dock`, `shadow-*`, `text-2xs`/`md`).
- Convenciones:
  - `Button` es `type="button"` por defecto y admite `asChild` para renderizar enlaces.
  - `IconButton` exige `aria-label` por tipos.
  - Los campos asocian etiqueta, ayuda y error (`aria-describedby`, `aria-invalid`).
  - Hay tamaño `lg` de 44 px para móvil, y `Checkbox` acepta `touch` para ampliar la zona táctil.
  - Los overlays usan `glass-raised`, así que respetan el modo cristal.
- Tests de componentes con Testing Library en jsdom, centrados en el comportamiento accesible (roles, nombres, teclado).

## Alternativas consideradas

- **Base UI** (`@base-ui/react`), de los mismos autores de Radix: muy prometedora y activa, pero más joven. Si
  algún día migramos, el cambio queda acotado a `packages/ui/src/components`.
- **React Aria:** excelente accesibilidad, pero más pesada y con más código por componente.
- **Copiar shadcn/ui:** su estética (radios, colores) no es la nuestra, y habría que reescribir cada componente igualmente.

## Consecuencias

- La app compone pantallas con `@muninn/ui` sin preocuparse de foco, teclado ni ARIA.
- `radix-ui` añade peso, aunque solo se empaquetan las primitivas que se usan.
- Algunas APIs del navegador que usa Radix no existen en jsdom: ver [gotchas/ui](../gotchas/ui.md).
