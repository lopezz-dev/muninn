# ADR-0087: Estilo nuevo: barra de abajo en cápsula, radios más grandes por papel, superficies sin borde y cifra protagonista

- **Estado:** Propuesto (la barra la eligió Alex el 10 de noviembre sobre el lienzo; falta aceptar la escala de radios y decidir el
  alcance; no hay código)
- **Fecha:** 2026-11-10
- **Área:** ui, web
- **Reemplazaría a:** los valores de los radios de [ADR-0014](0014-tokens-y-tailwind-v4.md) (los nombres y el mecanismo siguen) y el
  aspecto de la barra del teléfono de [ADR-0054](0054-shell-responsive-en-tres-tamanos.md) y
  [ADR-0072](0072-dock-configurable-hoja-de-cuenta-y-menu-de-usuario.md) (lo que hace la barra sigue igual)
- **Relacionado:** [ADR-0015](0015-modo-cristal.md), [ADR-0048](0048-pantallas-a-todo-el-ancho-y-alto.md),
  [ADR-0086](0086-inversiones-libro-de-operaciones-y-cartera-derivada.md)

## Contexto

Al diseñar las pantallas de Inversiones, Alex dijo que no le acaban de convencer la barra de abajo, algunos márgenes y los
estilos de la interfaz, y que le gusta cómo lo resuelven las apps de banca y de inversión que usa. El lienzo
[«Muninn — Inversiones»](https://claude.ai/artifact/7YFqY6PCJEQ1k6eHCz6cer) propone un estilo sobre las pantallas nuevas y
sobre Finanzas › Resumen, con tres opciones de barra. Alex eligió la **A**.

Cómo es hoy:
- **Radios pequeños**, pensados para una app densa de escritorio: controles 4 px, botones 5, tarjetas 6, diálogos 8 y la barra 12
  (ADR-0014). En el teléfono, con el dedo, todo se ve cuadrado y apretado.
- **Las tarjetas llevan borde** además de fondo.
- **La barra del teléfono ya flota** (`TabBar.tsx`): un rectángulo de 62 px con esquinas de 12, cada pestaña con su icono y su
  nombre debajo en 11 px, y tu avatar aparte en otro cuadrado. Se encoge a la pestaña activa al bajar.
- **La cifra más grande** es de 34 px (`text-3xl`); en Finanzas, el dato que importa compite con cuatro tarjetas iguales.

Restricciones: solo tokens de `@muninn/ui` (ADR-0014); el modo cristal tiene que seguir funcionando (ADR-0015); zona táctil de
44 px; contraste de texto 4,5:1 (hay un test); la barra sigue siendo configurable y con tu avatar (ADR-0072).

## Decisión

**1. Radios por papel, con valores nuevos.** Los nombres de los tokens no cambian; cambian sus valores y se añade uno:

| Token | Hoy | Nuevo | Para qué |
|---|---|---|---|
| `xs` | 2 px | 4 px | Marcas y detalles pequeños |
| `sm` | 4 px | 8 px | Controles pequeños: casillas, etiquetas |
| `md` | 5 px | 12 px | Campos, filas de menú, elementos dentro de una tarjeta |
| `lg` | 6 px | 20 px | Tarjetas y listas |
| `xl` | 8 px | 28 px | Diálogos y la parte de arriba de las hojas |
| `dock` | 12 px | se retira | La barra pasa a `rounded-full` |

Botones, pestañas de sección, selectores de periodo y chips van **en píldora** (`rounded-full`).

**2. Superficies sin borde.** Una tarjeta o una lista se distingue por su fondo (`surface` sobre `bg`), sin línea alrededor. El
borde se queda para lo que flota (menús, la barra) y para el modo cristal, donde el fondo es translúcido y hace
falta.

**3. Más aire.** En el teléfono el margen lateral sigue en 20 px; entre secciones, 24–32 px; dentro de una tarjeta, 20 px. Las
filas de una lista que se toca miden 68 px como mínimo, con un círculo de 40 px a la izquierda (instrumento, cuenta, categoría).
En el ordenador el margen de la pantalla pasa de 32 a 40 px.

**4. Una cifra protagonista por pantalla.** Tamaño nuevo `text-4xl` (44 px, seminegrita, con el espaciado cerrado) para el dato
que responde a la pregunta de la pantalla (lo que vale la cartera, lo que tienes). Debajo, la variación en una píldora. El resto
de cifras, a 20 px o menos.

**5. La barra del teléfono, en cápsula (opción A).**
- Una cápsula de 64 px de alto con los extremos redondos, separada de los bordes como hoy.
- Las pestañas que no están activas enseñan **solo el icono** (zona de 48 px de alto, con su nombre en `aria-label`). La activa
  es una píldora con el color de acento suave, con **icono y nombre en línea** (14 px, seminegrita).
- Tu avatar, en un círculo de 64 px aparte, a la derecha.
- No cambia nada de lo que hace: de una a cuatro pestañas elegidas por ti y guardadas en tu cuenta, «Buscar» como pestaña, las de
  un módulo desactivado ocultas, el avatar abre la hoja «Tu cuenta», se encoge a la pestaña activa al bajar, el fundido de debajo
  y la corrección del hueco en iOS.

**6. Alcance, en dos pasos** (lo que falta por decidir):
- **Paso 1, con Inversiones (0.12):** los tokens nuevos, los componentes de `@muninn/ui` (Button, Card, Dialog, Sheet, Menu,
  campos), la barra en cápsula y una pasada por **todas** las pantallas a 390, 820 y 1280 px solo para arreglar lo que el cambio
  de radios rompa. Las pantallas de Inversiones nacen ya con el estilo entero.
- **Paso 2, con el rediseño responsive (0.14):** rehacer el resto de pantallas con la cifra protagonista, las listas de filas
  altas y los márgenes nuevos.

## Alternativas consideradas

- **Opción B, barra pegada al borde con todas las etiquetas:** la más clara para quien llega nuevo, pero es la que más se parece
  a lo de hoy y la que más alto ocupa.
- **Opción C, cápsula de iconos con un botón de añadir:** pone la acción más frecuente a un toque, pero saca tu cuenta de la
  barra (habría que rehacer la hoja «Tu cuenta» y su acceso, ADR-0072) y «añadir» no significa lo mismo en cada pantalla.
- **Tokens nuevos (`card`, `sheet`) y dejar los de hoy como están:** nada se rompe, pero la app convive con dos escalas durante
  meses y cada pantalla nueva tiene que elegir. Cambiar los valores obliga a repasarlo todo una vez y deja una sola escala.
- **Que solo Inversiones estrene el estilo:** más rápido, y una app con dos aspectos según la pestaña en la que estés.
- **Rehacerlo todo en la 0.12:** se come las dos semanas de «Escribir sin conexión». El paso 2 ya tiene su sitio en la 0.14.
- **Copiar el aspecto de otra app:** se toman patrones comunes (cifra grande, píldoras, listas limpias), no la identidad de nadie.
  Muninn conserva su paleta, su tipografía y su acento.

## Consecuencias

- Positivas: la app deja de verse apretada en el teléfono; hay una jerarquía clara en cada pantalla; una sola escala de radios; la
  barra ocupa lo mismo y se lee mejor de un vistazo.
- Negativas / costes:
  - Cambiar el valor de `rounded-md` y `rounded-lg` toca de golpe unos 170 usos. Un elemento pequeño con `rounded-lg` pasa a ser
    casi un círculo: por eso el paso 1 incluye la pasada por todas las pantallas, con capturas en los tres tamaños.
  - **En la cápsula solo se lee el nombre de la pestaña activa.** Con cuatro pestañas y un nombre largo («Documentación») puede no
    caber en 360 px: la etiqueta se corta con puntos suspensivos. Hay que comprobarlo en los dos idiomas.
  - Sin bordes, dos tarjetas seguidas del mismo fondo dependen del espacio entre ellas: los márgenes dejan de ser opcionales.
  - `rounded-dock` desaparece: quien lo use (cuatro sitios) pasa a `rounded-full` o a `rounded-xl`.
  - El lienzo «Muninn — Pantallas» y «Móvil 2.0» quedan viejos en radios y barra; el de Inversiones es la referencia del estilo.
  - Hay que volver a pasar el test de contraste con `text-4xl` y las píldoras de variación (verde y rojo sobre su fondo suave).
- Relacionado: `packages/ui/src/tokens.ts`, `packages/ui/src/theme.css`, `apps/web/src/shell/TabBar.tsx`,
  `apps/web/src/screens/ajustes/Barra.tsx`, [gotchas/ui](../gotchas/ui.md), tarjeta «Rediseño responsive» (punto 4) en el tablero de
  Muninn.
