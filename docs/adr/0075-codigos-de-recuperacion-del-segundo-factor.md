# ADR-0075: Códigos de recuperación del segundo factor con la API experimental de Supabase

- **Estado:** Aceptado
- **Fecha:** 2026-11-03
- **Área:** core, web
- **Complementa a:** [ADR-0061](0061-seguridad-de-la-cuenta.md)

## Contexto

Con el segundo factor activado ([ADR-0061](0061-seguridad-de-la-cuenta.md)), perder el móvil deja fuera de la cuenta: la única copia
era la clave de configuración, que hay que haber guardado y volver a meter en otra app de códigos. ADR-0061 dejó los códigos de
recuperación como tarea porque en supabase-js eran experimentales.

Supabase Auth los trae desde GoTrue v2.197.0 (el proyecto ya va en esa versión) con cinco llamadas: estado, generar, comprobar,
regenerar y borrar (`/factors/recovery-codes…`). Son un factor más (`recovery_code`) que no puede quedarse solo
(`mfa_recovery_codes_sole_factor`) y cuyos códigos solo se ven una vez, al generarlos. En supabase-js 2.118 la API está detrás de
una opción del cliente (`auth.experimental.recoveryCodes`): sin ella, las llamadas lanzan.

## Decisión

- **Usamos la API experimental** (`auth.mfa.recoveryCodes.*`), activada en el único cliente del navegador (`lib/auth.ts`).
- **Core:** `RecoveryCodesStore` (`status`, `generate`, `remove`) dentro de `MfaStore`, con su versión en memoria. `account.mfa.recoveryCodes`
  expone `status()` y `generate()`; generar exige el segundo factor activado y, si ya había códigos, los sustituye (`regenerate`).
  `disable()` borra los códigos **antes** de quitar la app de códigos: después ya no habría `aal2` para borrarlos y Supabase no deja
  que se queden solos.
- **Alta:** al confirmar el primer código se generan diez y el último paso los enseña con «Copiar todos». Si el servidor no los da, el
  alta acaba igual (el segundo factor ya está activado) y se pueden generar luego.
- **Ajustes › Cuenta:** con el segundo factor activado, una fila «Códigos de recuperación» dice cuántos quedan y ofrece «Generar» o
  «Generar nuevos». Con dos o menos, se destaca.
- **Entrar:** en «Falta un paso», «Usa un código de recuperación» cambia el campo a texto libre y llama a `recoveryCodes.verify`, que sube
  la sesión a `aal2` como el código de la app. Va en `lib/second-factor.ts`, fuera del core, como el resto del paso del código
  (ADR-0022): ocurre antes de que exista el core.
- Generar otros no tiene «Deshacer» (los anteriores no se pueden recuperar): el diálogo lo explica antes y genera al pulsar. Con los
  códigos a la vista, un clic fuera no lo cierra.

## Alternativas consideradas

- **Esperar a que la API deje de ser experimental:** el riesgo de quedarse fuera de la cuenta existe ya, y la superficie que usamos es
  pequeña (cinco llamadas en un solo fichero del store y una en `second-factor.ts`).
- **Códigos propios (tabla con hashes y una función que suba a `aal2`):** el `aal` lo pone Supabase Auth en el token; no se puede subir
  desde SQL sin emitir tokens nosotros.
- **Un segundo factor TOTP de respaldo:** es lo que proponían las guías antiguas de Supabase, pero obliga a tener otra app en otro
  dispositivo, que es justo lo que falta cuando se pierde el móvil.

## Consecuencias

- Positivas: perder el móvil ya no deja fuera de la cuenta. La demo y los tests usan la misma API del core (cuenta en memoria).
- Negativas / costes: dependemos de una API marcada como experimental; al actualizar supabase-js hay que revisar sus cambios (gotchas/web).
  Los nombres de error de un código que no vale no están documentados: `recoveryCodeErrorMessage` agrupa los probables y, si no
  coincide, cae en el mensaje genérico. La prueba real (el paso de entrar y que el código suba a `aal2`) queda para la fase final.
- Relacionado: [gotchas/web](../gotchas/web.md) («Códigos de recuperación: API experimental»), `packages/core/src/account.ts`,
  `packages/core/src/supabase-store.ts`, `apps/web/src/lib/second-factor.ts`, `apps/web/src/screens/ajustes/SegundoFactorDialogos.tsx`.
