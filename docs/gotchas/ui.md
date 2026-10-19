# Gotchas · ui (`packages/ui`)

### `tokens.css` es generado: no se edita a mano

- **Síntoma:** el test `tokens.css está sincronizado con tokens.ts` falla.
- **Solución:** cambia `src/tokens.ts` y ejecuta `pnpm --filter @muninn/ui tokens`. Commit de los dos ficheros.
- **Ref:** [ADR-0014](../adr/0014-tokens-y-tailwind-v4.md)

### La paleta de Tailwind está desactivada

- **Síntoma:** `bg-red-500`, `text-gray-400` o `rounded-2xl` no aplican nada, sin ningún error.
- **Causa:** `theme.css` hace `--color-*: initial` (y lo mismo con fuentes, radios, sombras y texto).
- **Solución:** usa los tokens: `bg-surface`, `text-fg-muted`, `bg-danger-soft`, `bg-project-violet`,
  `bg-kind-done`, `rounded-lg`… Si falta uno, añádelo a `tokens.ts` y a `theme.css`.

### La app debe declarar `@source` hacia `packages/ui/src`

- **Síntoma:** un componente de `@muninn/ui` sale sin estilos.
- **Causa:** Tailwind solo genera las clases que ve en los ficheros que escanea, y no escanea `node_modules`
  ni los paquetes enlazados.
- **Solución:** en el CSS de la app, `@source "<ruta relativa>/packages/ui/src";` (ya está en `apps/web/src/index.css`).

### Biome necesita `tailwindDirectives`

- **Síntoma:** errores de `parse` en `@theme`, `@utility` o `@source`.
- **Solución:** `biome.json` → `"css": { "parser": { "tailwindDirectives": true } }` (ya configurado).

### El cristal necesita algo detrás

- **Síntoma:** con el cristal activado no se nota ningún desenfoque.
- **Causa:** `backdrop-filter` desenfoca lo que hay detrás. Sobre un fondo liso no cambia nada.
- **Solución:** el fondo (`--mn-wallpaper`) ya tiene matices. Los paneles flotantes (menús, diálogos) se ven
  mejor sobre contenido. No uses `glass` en elementos opacos anidados dentro de otro `glass`: se desenfoca dos veces.

### `backdrop-filter` en Linux (WebKitGTK)

- WebKitGTK puede ir notablemente más lento con muchos paneles desenfocados. Si en Linux va a tirones, el
  plan es apagar el cristal por defecto en esa plataforma (Tauri expone el SO) y no quitar la opción.

### Iconos: importar siempre desde `@muninn/ui`

- No importes de `@phosphor-icons/react` en la app: usa `icons.x` o `<Icon name="x" />`. Así el catálogo
  queda centralizado y la librería se puede cambiar.
- Un botón con solo un icono necesita `aria-label`. `<Icon>` pone `aria-hidden` salvo que le pases `aria-label`.

### El acento se aplica en ejecución

- `applyAppearance` escribe `--mn-color-accent*` en el `style` de `<html>`, después del render (efecto).
  Si lees colores calculados justo tras un clic (tests E2E), espera al siguiente frame.

### Biome no formatea `tokens.css`

- **Síntoma:** tras `pnpm format`, el test de sincronización falla porque Biome pasó los hex a minúsculas y partió líneas.
- **Solución:** `packages/ui/src/tokens.css` está excluido en `biome.json`. Si mueves o renombras el fichero, actualiza la exclusión.

### Combinar clases siempre con `cn()`, que conoce nuestros tokens

- **Síntoma:** al pasar `className` a un componente, una clase propia desaparece o conviven dos que chocan.
- **Causa:** `tailwind-merge` sin configurar no sabe que `rounded-dock` es un radio ni que `shadow-drag` es una sombra.
- **Solución:** usa `cn()` de `@muninn/ui`. Si añades un token con nombre nuevo (radio, sombra, tamaño de texto),
  regístralo también en `src/cn.ts` y añade un caso al test de `cn`.

### Diálogos: título obligatorio y la descripción ausente, explícita

- Radix avisa en la consola si un `Dialog.Content` no tiene `Title`, o si no tiene `Description` sin
  `aria-describedby={undefined}`. `DialogContent` y `SheetContent` ya lo resuelven: exigen `title` y
  `hideTitle` lo oculta visualmente sin quitarlo. No uses `RDialog.Content` directamente.

### `Button` con `asChild` no lleva `type`

- Con `asChild`, el estilo se aplica al hijo (`<a>`), y `type="button"` en un enlace sería inválido. El componente
  ya lo omite. Si haces un wrapper propio, respeta esta regla.

### Tests de componentes: jsdom y stubs

- Radix usa `ResizeObserver`, `scrollIntoView` y la captura de puntero, que jsdom no implementa. `test/setup-dom.ts`
  añade stubs. Los ficheros de test de componentes empiezan con `// @vitest-environment jsdom` e importan ese setup.
- jsdom normaliza los colores en línea a `rgb()`: compara con `rgb(…)`, no con el hex.
- Para abrir un `DropdownMenu` en un test, enfoca el disparador y pulsa `Enter`: el clic simulado no siempre dispara `pointerdown`.

### Las animaciones de entrada desplazan la medición

- Los overlays entran con `animate-slide-in-*` y `animate-pop-in`. Si mides su posición (tests E2E, scripts),
  espera a que acabe la animación (unos 300 ms) o desactiva el movimiento con `prefers-reduced-motion`.
