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
- Los trazos vienen de `src/icons.generated.ts` y `src/screen-icons.generated.ts` (ADR-0058), con solo `regular` y
  `bold`. **Al añadir un icono**, impórtalo en el catálogo desde el fichero generado y ejecuta
  `pnpm --filter @muninn/ui icons`; si no, falla el test de sincronización. **Si usas otro grosor** (`fill`, `light`…)
  en un icono, añádelo en `EXTRA_WEIGHTS` de `scripts/icons.ts`: sin eso se pinta el regular sin avisar.
- `@phosphor-icons/react/lib` no existe en tiempo de ejecución (solo tiene tipos); importa de `…/dist/lib/IconBase`,
  `…/dist/lib/context` y `…/dist/lib/types`. Biome no formatea los `*.generated.ts` (excluidos en `biome.json`).
- Un botón con solo un icono necesita `aria-label`. `<Icon>` pone `aria-hidden` salvo que le pases `aria-label`.

### El acento se aplica en ejecución

- `applyAppearance` escribe `--mn-color-accent*` en el `style` de `<html>`, después del render (efecto).
  Si lees colores calculados justo tras un clic (tests E2E), espera al siguiente frame.

### Biome no formatea `tokens.css`

- **Síntoma:** tras `pnpm format`, el test de sincronización falla porque Biome pasó los hex a minúsculas y partió líneas.
- **Solución:** `packages/ui/src/tokens.css` está excluido en `biome.json`. Si mueves o renombras el fichero, actualiza la exclusión.

### Combinar clases siempre con `cn()`, que conoce nuestros tokens

- **Síntoma:** al pasar `className` a un componente, una clase propia desaparece o conviven dos que chocan.
- **Causa:** `tailwind-merge` sin configurar no sabe que `shadow-drag` es una sombra ni que `text-2xs` es un tamaño.
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

### Un componente con primitiva de Radix por módulo

- **Síntoma:** el JS inicial de la app incluye `DropdownMenu`, `Checkbox` o `ToggleGroup` aunque solo los use
  una pantalla diferida.
- **Causa:** el bundler no parte un módulo entre chunks. Si `TextField` y `Switch` viven en el mismo fichero y
  el shell usa `TextField`, `Switch` y su primitiva viajan con él.
- **Solución:** cada componente que importa una primitiva pesada va en su propio fichero (`menu.tsx`,
  `tooltip.tsx`, `toggles.tsx`, `segmented-control.tsx`). `package.json` declara `"sideEffects": ["*.css"]`
  para que lo no usado se pueda descartar.

### Lo que flota va con `glass-floating`, no con `glass-raised`

- **Síntoma:** con el cristal activado, un menú o el calendario de un campo de fecha abierto encima de un diálogo deja ver lo de
  detrás (el botón naranja «Crear tarea») y se lee peor.
- **Causa:** `surface-raised` en cristal está al 74 %: dos capas así una encima de otra no tapan lo suficiente.
- **Solución:** menús, popovers y el calendario usan `glass-floating` (`surface-floating`, al 93 % en cristal e igual que
  `surface-raised` en sólido). Los diálogos y las hojas siguen con `glass-raised`.

### Selección sobre cristal: `bg-fg/[0.07]`, no `bg-surface-raised`

- **Síntoma:** con el cristal activado, la opción seleccionada de una lista dentro de un panel `glass-raised`
  no se distingue.
- **Causa:** `surface-raised` en cristal es translúcido y casi igual que el propio panel.
- **Solución:** para resaltar dentro de un panel elevado, un velo del color de texto (`bg-fg/[0.07]`), que se
  ve en sólido y en cristal.

### `DialogContent` con `bare` y `size`

- `bare` quita cabecera, relleno y botón de cerrar (el título queda solo para lectores de pantalla); Escape
  sigue cerrando. En móvil, pon tú un botón de cerrar visible. `size="lg"` son 660 px (buscador ⌘K).

### `transition-colors` también anima el anillo de foco

- En Tailwind v4 incluye `outline-color`: el anillo de foco entra con un fundido de 150 ms. Si un test lee
  `outlineColor` justo después de enfocar, verá el color anterior; espera o desactiva la transición.

### `IconButton` con `asChild` no admite hijos

- **Síntoma:** `Property 'children' does not exist on type 'IconButtonProps'` al envolver un `<Link>`.
- **Causa:** el icono va en la prop `icon`, y `Slot` necesita un único hijo.
- **Solución:** para un enlace con solo un icono, `<Button asChild variant="secondary" className="size-11 px-0"><Link aria-label="…"><icons.x/></Link></Button>`.

### Submenús: `MenuSub` + `MenuSubTrigger` + `MenuSubContent`

- Están en `menu.tsx` (con el resto del menú, para que Radix no viaje a otros chunks). Un `MenuItem` dentro de un
  `MenuSubContent` se selecciona igual que uno normal. El disparador lleva su chevron.

### Cabeceras estrechas: el límite WIP se pinta en el contador, no con una etiqueta

- La cabecera de una columna mide 264 px: asa, color, nombre, contador, «+» y «⋯». Con una etiqueta «Excedido» al lado, el
  nombre se quedaba en tres letras. `ColumnCount` pinta `3 / 2` en ámbar (límite alcanzado) o rojo (superado), con
  `title` y texto para lectores de pantalla.

### Abrir un menú de Radix desde un script (verificación en el navegador)

- **Síntoma:** `button.click()` en la consola no abre un `Menu`, y sin él no se llega a sus elementos.
- **Causa:** `DropdownMenu` se abre con `pointerdown`, no con `click`.
- **Solución:** `button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse', isPrimary: true }))`,
  espera ~600 ms y haz `click()` en el `[role=menuitem]`. Los avisos duran 4–6 s: pulsa su «Deshacer» en el mismo script,
  sin esperar entre llamadas, o habrá desaparecido.

### Iconos de una sola pantalla: `screenIcons`

- Ver [gotchas/web](web.md#un-icono-que-solo-usa-una-pantalla-no-va-en-icons): están en `packages/ui/src/screen-icons.tsx`,
  fuera de `icons`, para no engordar el arranque.

### Colores de gráficos: `chart-income` y `chart-expense`, validados

- **Síntoma:** un gráfico nuevo con los colores de la paleta de proyectos (verde, ámbar) o con gris para una serie.
- **Causa:** en oscuro, el ámbar y el verde de la paleta quedan fuera de la banda de luminosidad de la skill `dataviz` y el gris no
  tiene croma: no se distinguen bien con daltonismo o se leen como «sin dato».
- **Solución:** ingresos y gastos usan `bg-chart-income` (azul) y `bg-chart-expense` (naranja), validados con
  `node <skill dataviz>/scripts/validate_palette.js "#5B8DEF,#CF7A2E" --mode dark --surface "#15181C"`. Si añades una serie o cambias un
  color, vuelve a pasar el validador. Las categorías usan el color que eligió el usuario (identidad), no estos.
- **Ref:** [ADR-0039](../adr/0039-panel-mensual-y-tasa-de-ahorro.md)

### `CodeField`: un solo `input` debajo de las casillas

- **Síntoma:** quieres cambiar algo de las casillas del código (enfocar una, poner el cursor en medio) y no hay seis campos.
- **Causa:** es un único `<input>` transparente encima de las casillas, a propósito: así pegar, el autocompletado del móvil
  (`one-time-code`) y los gestores de contraseñas funcionan sin código propio ([ADR-0063](../adr/0063-codigos-con-casillas-sobre-un-solo-campo.md)).
- **Solución:** no lo partas en seis. El cursor se fuerza al final (`onSelect`); el `input` mantiene 16 px de letra aunque sea
  invisible (si no, el iPhone hace zoom). El temblor del error vuelve a montar **solo la fila de casillas**: si montara el
  `input`, perdería el foco. Tras un error con el campo desactivado, devuélvele el foco tú (`SegundoFactorDialogos.tsx`).

### `IconButton` no reenvía `ref`: para dnd-kit, envuélvelo

- **Síntoma:** `Property 'ref' does not exist on type 'IconButtonProps'` al usar `setNodeRef` de `useDroppable` en un `IconButton`.
- **Causa:** `IconButton` no declara `ref` en sus props.
- **Solución:** envuélvelo en un `<span ref={setNodeRef} className="flex">` (así lo hacen las flechas ‹ › del calendario, que reciben
  tareas arrastradas). Para un `Tooltip` sobre algo que se arrastra, pásale `disabled` mientras haya un arrastre: así no se queda abierto,
  y el disparador no se vuelve a montar (desmontarlo cortaría el arrastre).

### Textos: nunca fijos en un componente, siempre de `useUiLocale()`

- **Síntoma:** con la app en inglés, el selector de fecha, el «Cerrar» de un diálogo o el de un aviso salen en español.
- **Causa:** `@muninn/ui` no usa i18next ([ADR-0077](../adr/0077-i18n-ingles-por-defecto-con-i18next.md)). Un texto escrito tal cual
  en el componente (o un `Intl.DateTimeFormat('es-ES')`) no cambia con el idioma.
- **Solución:** etiqueta nueva → campo en `UiLabels` (`src/locale.tsx`) con su respaldo en inglés en `UI_LOCALE_EN`, y la traducción
  en la app (`apps/web/src/i18n/locales/*/common.ts` › `ui`, y `uiLocale()` en `src/i18n/ui-locale.tsx`). En el componente,
  `const { locale, labels } = useUiLocale()` **al principio** (es un hook: nada de llamarlo dentro del JSX). Fechas y números con
  `Intl` y ese `locale`, guardando el formateador por idioma. `test/locale.test.tsx` monta los componentes sin proveedor y falla si
  encuentra español en el texto, los `aria-label`, los `title` o los `placeholder`: añade ahí cada componente nuevo con texto.
- **Ojo:** `AmountField` aún recibe `locale` por prop (`es-ES` por defecto); pasarlo al contexto queda para cuando se toque.

### Radios por papel: un elemento pequeño con `rounded-lg` queda casi redondo

- **Síntoma:** un icono en un cuadro de 44 px, un chip de 22 px o una casilla salen como un círculo deforme, ni círculo ni cuadro.
- **Causa:** desde [ADR-0087](../adr/0087-estilo-nuevo-capsula-radios-y-margenes.md) los radios son grandes: `xs` 4, `sm` 8, `md` 12,
  `lg` 20 y `xl` 28 px. Cuando el radio pasa de un tercio del lado corto sin llegar a la mitad, se ve mal.
- **Solución:** elige el radio por lo que es el elemento, no por costumbre. Tarjetas y listas, `rounded-lg`; diálogos y hojas,
  `rounded-xl`; campos, filas y **lo que flota** (menús, popovers), `rounded-md` (con el relleno de 4 px del menú, sus filas en
  `rounded-sm` encajan); casillas y código en línea, `rounded-xs`. Botones, chips, pestañas, buscadores y cualquier cuadro de
  icono o avatar de menos de ~52 px, `rounded-full`. `rounded-dock` ya no existe.
- **Para comprobarlo:** en la consola, recorre los elementos y busca los que tengan `radio / lado corto` entre 0,36 y 0,5 (así se
  hizo la pasada del paso 1). Las filas de 28–32 px con `rounded-md` del ordenador salen en esa lista y están bien así.

### `Card` no lleva borde, salvo con el cristal: `glass-on:`

- **Síntoma:** una tarjeta sobre otra superficie del mismo color no se distingue; o esperabas el borde y no está.
- **Causa:** en sólido, una superficie se distingue por su fondo (ADR-0087). `Card` solo pinta el borde con el cristal activado,
  con la variante `glass-on:` de `theme.css` (`glass-on:border glass-on:border-border`).
- **Solución:** no pongas una `Card` sobre `bg-surface`: sepárala con espacio o usa `bg-surface-sunken`. Si haces una superficie
  propia, usa la misma variante en vez de un borde fijo. Las tarjetas hechas a mano en las pantallas aún llevan borde: se quitan
  en el paso 2 de ADR-0087.

### La barra en cápsula: el ancho está contado

- En un teléfono de 360 px con cuatro pestañas no sobra nada (`apps/web/src/shell/TabBar.tsx`). Los iconos inactivos ceden de 44 a
  40 px antes de que se corte el nombre de la activa (`flex-[0_1000_44px]` frente a `flex-[0_1_auto]`). Caben «Proyectos» y
  «Finanzas»; «Documentación» se corta con puntos suspensivos. Si cambias márgenes, relleno o el tamaño de la letra, vuelve a medir a
  360 px en los dos idiomas.
