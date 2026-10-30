# ADR-0069: Noticias equilibradas por fuente: rachas plegadas en «Todas» y resumen repartido

- **Estado:** Aceptado
- **Fecha:** 2026-10-30
- **Área:** core, web

## Contexto

Con datos reales, una fuente que publica sin parar (Expansión, unos 50 artículos al día) se lleva casi toda la pantalla de
Noticias: el 30 de octubre, 48 de los últimos 50 artículos eran suyos y Node.js o Apple Developer quedaban muy abajo. El resumen
del día ([ADR-0042](0042-noticias-rss-con-descarga-en-servidor.md)) era peor: el modelo recibe como mucho `DIGEST_MAX_ITEMS`
(25) artículos y se cogían los 25 más recientes, así que solo veía Expansión.

## Decisión

- **Resumen:** los artículos que se mandan al modelo se eligen con `balanceBySource` (`packages/core/src/news.ts`): por rondas,
  el más reciente de cada fuente que quede, hasta llenar el hueco. Si caben todos, no se toca nada. La web pide 200 artículos
  (antes 100) para tener de dónde repartir dentro de la ventana de 30 horas.
- **Lista, en «Todas» y sin buscar:** se mantiene el orden por fecha, pero cada racha seguida de una misma fuente enseña
  `NEWS_RUN_KEEP` (3) artículos y pliega el resto en «Ver N más de …», en su sitio (`collapseRuns`, `apps/web/src/lib/news.ts`).
  Una racha que solo escondería uno no se pliega. Lo desplegado se recuerda mientras sigues en la pantalla.
- **Filtrar por fuente:** pulsar el nombre de la fuente en un artículo deja solo los suyos, con «Solo X ✕» para quitarlo. Con
  ese filtro, en un tema o buscando no se pliega nada: ahí lo que se busca es justo eso.

## Alternativas consideradas

- **Tope fijo por fuente en «Todas» (p. ej. 5 por fuente):** esconde la mayoría de lo que llega de la fuente principal y el
  contador «Todas · N» deja de cuadrar con lo que se ve.
- **Intercalar las fuentes en la lista (por rondas, como el resumen):** rompe el orden por fecha y mezcla algo de hace dos días
  con lo de hace un minuto.
- **Peso o prioridad por fuente elegido por el usuario:** más ajustes que mantener y una migración, para un problema que se
  resuelve sin configurar nada. Se puede añadir encima si hace falta.

## Consecuencias

- Positivas: las fuentes pequeñas asoman en la lista y entran en el resumen sin configurar nada; el orden por fecha se mantiene.
- Negativas / costes: el resumen puede dejar fuera artículos recientes de la fuente grande a cambio de otros más antiguos de
  las pequeñas (dentro de la ventana de 30 horas). La pantalla sigue cargando los 200 más recientes: con una fuente muy activa,
  lo de las otras con más de unos días puede no llegar a la lista.
- Relacionado: [ADR-0042](0042-noticias-rss-con-descarga-en-servidor.md), `packages/assistant/src/digest.ts`,
  `apps/web/src/screens/Noticias.tsx`, guía [Noticias](../user/12-noticias.md).
