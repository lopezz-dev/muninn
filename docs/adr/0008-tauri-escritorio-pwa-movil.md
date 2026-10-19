# ADR-0008: Tauri 2 para escritorio y PWA para móvil

- **Estado:** Aceptado
- **Fecha:** 2026-10-19
- **Área:** desktop, web

## Contexto

Se necesita escritorio (Windows, Linux y macOS) y móvil (iPhone). Una app nativa de iOS se puede
usar sin coste para uso propio, pero distribuirla a otras personas exige pasar por la App Store.
El autor tiene Apple Developer Program.

## Decisión

- **Una única UI React** en `apps/web`.
- **Escritorio:** Tauri 2 (`apps/desktop`) carga el build de `apps/web`. Ligero, en Rust, con
  instaladores para las tres plataformas desde GitHub Actions.
- **Móvil:** la misma app como **PWA** instalable, con Web Push en iOS 16.4+ (solo instalada en la pantalla de inicio).
- En Tauri no se registra el service worker (`TAURI_ENV_PLATFORM` desactiva el plugin PWA).

## Alternativas consideradas

- **Electron:** binarios de más de 100 MB y más memoria.
- **App nativa con Expo:** mejor experiencia en el móvil, pero otro frontend que mantener y la App Store para distribuirla.
- **Tauri mobile:** todavía inmaduro y también exige la App Store.

## Consecuencias

- Un solo frontend para todas las plataformas.
- Limitaciones de la PWA en iOS: no hay widgets ni ejecución en segundo plano.
- macOS necesita firma y notarización para no mostrar avisos: ver [ADR-0010](0010-ramas-y-releases.md).
- Se puede pasar a Expo más adelante sin tocar el core.
