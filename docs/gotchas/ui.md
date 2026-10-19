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

### Nunca cambies el `font-size` de `<html>`

- **Síntoma:** todo sale un poco más pequeño de lo diseñado (botones de 28 px en vez de 32) y piezas con medidas
  en `px` fijos (la bolita del interruptor) no encajan con las que van en `rem`.
- **Causa:** el espaciado de Tailwind usa `rem`. Si `<html>` tiene 14 px, 1 rem = 14 px y todo encoge un 12,5 %.
- **Solución:** el tamaño base del texto va en `body` (`theme.css`). En los componentes, mejor la escala de Tailwind
  (`translate-x-3.5`) que píxeles sueltos.

### Overlays centrados: posición en píxeles enteros

- **Síntoma:** al pasar el ratón por primera vez sobre un botón de un diálogo, el contenido «salta» medio píxel.
- **Causa:** `translate(-50%, -50%)` o `margin: auto` dejan el diálogo en coordenadas como 96,5. Al repintar, el
  navegador encaja la capa en la rejilla de píxeles y el texto se mueve.
- **Solución:** `DialogContent` calcula `left`/`top` con `round(down, …, 1px)` y se ancla a 12vh del borde superior.
  No vuelvas a centrar con `translate`. Los paneles laterales y las hojas van pegados a los bordes, así que no tienen el problema.

### Importes: `AmountField` y céntimos

- No uses `<input type="number">` para dinero: admite `e`, `+` y `-`, no entiende la coma decimal y su valor es un float.
- `AmountField` ignora lo que no encaje en `^\d{0,9}([.,]\d{0,2})?$` (también al pegar), usa `inputMode="decimal"`
  y entrega **céntimos enteros**. `formatAmount` usa `useGrouping: 'always'`, porque en es-ES Intl no agrupa los
  números de 4 cifras («1284,30» en vez de «1.284,30»).
- **Ref:** [ADR-0018](../adr/0018-dinero-en-centimos.md)

### Notificaciones: solo con `notify`, y `<Toaster />` una sola vez

- Importa `notify` / `Toaster` de `@muninn/ui`, nunca `sonner`. `<Toaster />` va una vez en la raíz (`apps/web/src/main.tsx`):
  si se monta dos veces, cada aviso sale duplicado.
- Toda acción del usuario da feedback, y lo destructivo o reversible lleva «Deshacer»
  ([ADR-0019](../adr/0019-feedback-con-notificaciones.md)).
- No llames a una variable de estado `notify`: tapa la función importada y TypeScript se queja de `.success` en un booleano.

### El portapapeles necesita un gesto real del usuario

- **Síntoma:** «No se pudo copiar el enlace» en tests E2E o scripts, pero funciona al hacer clic a mano.
- **Causa:** `navigator.clipboard.writeText` exige activación del usuario y un documento con foco. Un `.click()`
  sintético no cuenta.
- **Solución:** en E2E, usa clics reales del navegador (Playwright `click`), o simula `copyText`.

### Sonner en tests (jsdom)

- Necesita `matchMedia` y `setPointerCapture`, que ya están como stubs en `test/setup-dom.ts`. Envuelve `notify.*` en
  `act()` y busca con `findByText`, porque el render es asíncrono.

### Animaciones con retardo: `forwards`, no `both`

- **Síntoma:** un elemento que debía aparecer al final de una coreografía (el anillo del check) se ve quieto desde el principio.
- **Causa:** `animation-fill-mode: both` aplica el primer fotograma **durante el retardo**. Si ese fotograma es
  visible (`opacity: 0.45`), se ve antes de tiempo.
- **Solución:** con retardo y primer fotograma visible, usa `forwards`; o empieza el keyframe en el estado invisible.

### Gestos de icono: `translate`/`rotate`/`scale` sueltos, no `transform`

- La insignia encadena dos animaciones sobre el mismo icono (gesto + salida). Si ambas tocaran `transform`, la
  segunda pisaría la primera. Por eso los gestos usan `translate`/`rotate` y la salida, `scale`/`opacity`/`filter`.
- Para revisar una coreografía fotograma a fotograma: `document.getAnimations()` filtrando por el elemento,
  `a.pause(); a.currentTime = t`, y leer los `getComputedStyle` (también los de `::after`).

### Notificaciones: pasa el icono de la acción

- `notify.success('Enlace copiado', { icon: 'link' })`: el icono hace su gesto (se eleva, avanza, cae, tiembla, gira)
  y se transforma en el check. Sin `icon` solo se dibuja el check. El gesto de cada icono está en `MOTION`
  (`notify.tsx`); los iconos sin gesto propio laten.
