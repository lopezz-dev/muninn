# ADR-0063: Códigos de una sola vez con casillas sobre un solo campo, y el segundo factor en su diálogo

- **Estado:** Aceptado
- **Fecha:** 2026-10-29
- **Área:** ui, web
- **Reemplaza a:** —

## Contexto

Activar el segundo factor (ADR-0061) se desplegaba dentro de la tarjeta «App de códigos» de Ajustes › Cuenta: pasos,
QR, clave y un campo de texto normal para el código. En la prueba de la fase final funcionaba, pero se veía apretado y
poco cuidado para algo que el usuario hace una vez y con el móvil en la otra mano. Se pidió un diálogo propio, con
pasos, el QR bien presentado, la clave fácil de copiar, casillas por cifra con pegado automático y un final claro.

Las casillas por cifra tienen una trampa conocida: si cada casilla es un `<input>`, pegar el código, el autocompletado
del móvil (`autocomplete="one-time-code"`), los gestores de contraseñas y el borrado hacia atrás hay que reprogramarlos
a mano, y el lector de pantalla anuncia seis campos.

## Decisión

- `CodeField` (`@muninn/ui`) dibuja una casilla por cifra, pero por debajo es **un solo `<input>`** transparente encima
  de ellas. El navegador hace lo de siempre (pegar, autocompletar, borrar, deshacer); las casillas solo pintan el valor
  y cuál toca. Limpia lo que no son cifras (pegar «123 456» vale) y avisa con `onComplete` al llenarse.
- Activar el segundo factor es un **diálogo** (hoja desde abajo en el teléfono) con tres pasos: escanear el QR →
  guardar la clave → escribir el código, que se comprueba solo al completarse. Termina con `SuccessMark`, un check
  animado con la coreografía de las notificaciones. Desactivar es otro diálogo que pide el código y se envía a mano.
- Un clic fuera del diálogo de alta no lo cierra (se perdería el QR a medias); Escape y la X sí.

## Alternativas consideradas

- **Seis `<input>` de una cifra:** es lo que parece natural, pero obliga a reprogramar pegar, el autocompletado del
  iPhone y el foco entre casillas, y es peor con lector de pantalla.
- **Una librería (`input-otp`):** hace lo mismo con más opciones de las que usamos; preferimos un componente de 100
  líneas con nuestros tokens.
- **Mantenerlo en la tarjeta de Ajustes, mejor maquetado:** no da sitio a los pasos ni al final con éxito, y en el
  teléfono empujaba el resto de la página.

## Consecuencias

- Positivas: el pegado y el autocompletado funcionan en todas partes sin código propio; el alta se entiende paso a paso;
  `CodeField` y `SuccessMark` sirven para otros códigos (la entrada con segundo factor de `/login`).
- Negativas / costes: el `<input>` invisible tiene que tener al menos 16 px de letra (si no, el iPhone hace zoom) y el
  cursor siempre al final; no se puede editar una cifra del medio (se borra hacia atrás).
- Relacionado: [ADR-0061](0061-seguridad-de-la-cuenta.md), [ADR-0019](0019-feedback-con-notificaciones.md),
  `packages/ui/src/components/code-field.tsx`, `apps/web/src/screens/ajustes/SegundoFactorDialogos.tsx`,
  [gotchas/ui](../gotchas/ui.md#codefield-un-solo-input-debajo-de-las-casillas).
