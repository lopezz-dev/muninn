# ADR-0043: Informe de la mañana generado en el ordenador y guardado como nota fijada

- **Estado:** Aceptado
- **Fecha:** 2026-10-22
- **Área:** web, core
- **Relacionado:** [ADR-0041](0041-asistente-local-con-catalogo-unico.md), [ADR-0042](0042-noticias-rss-con-descarga-en-servidor.md)

## Contexto

La F4 pide «agentes que informan»: un informe de la mañana con las tareas de hoy y vencidas, los cobros próximos y el resumen
de noticias, generado en local, legible desde cualquier dispositivo y con su hora configurable. El modelo solo existe en el ordenador
(ADR-0041), que puede estar apagado a esa hora, y en el iPhone no hay modelo ni ejecución en segundo plano (ADR-0008).

## Decisión

- **Quién lo hace:** la app abierta en un dispositivo que **no** es móvil (escritorio o navegador del ordenador). Un componente sin
  pintura (`MorningReportRunner`, en su propio chunk y solo si el informe está activado) mira cada minuto si toca: activado, ya pasó la hora
  (`HH:MM` local) y aún no se hizo **hoy**.
- **Qué lleva:** la parte con datos es **fija**, sin modelo (`buildMorningReport` de `@muninn/assistant`, con tests): tareas vencidas,
  para hoy y en curso; cobros de los próximos 7 días; y el resumen de noticias del día (si no lo hay y hay modelo, se genera, ADR-0042).
  Las secciones de módulos desactivados no salen. Si el modelo está listo, añade **una entradilla** de una o dos frases arriba; si no, el
  informe sale igual. Así nunca inventa datos y se puede comprobar.
- **Dónde se guarda:** como **nota fijada** («Informe de la mañana · jueves, 22 oct»), creada con actor `assistant` y
  `payload.context = { report: 'morning' }`. Se lee en Notas en cualquier dispositivo, la encuentra el MCP (`list_notes`) y se puede editar o
  archivar. Al hacer el siguiente, el anterior se **desfija** (no se archiva ni se borra). El último sale además arriba en la lista del Asistente
  («automático», como en el lienzo).
- **Ajustes:** `user_settings.preferences.morningReport = { enabled, time, lastDate, lastNoteId }`, en Ajustes › Asistente e IA (interruptor,
  hora y «Hacer ahora»). **Desactivado por defecto**: crea una nota cada día y eso lo decide el usuario.
- **Si el ordenador estaba apagado a esa hora:** se hace **al abrir Muninn ese día**, y la primera línea lo dice («Hecho a las 10:42: a las
  08:30 el ordenador estaba apagado o Muninn cerrado»). **Nunca recupera días pasados**: si no se abre en todo el día, ese día no hay informe.
- **Sin duplicados:** antes de generarlo se vuelven a leer los ajustes del servidor (`lastDate`); dentro de una pestaña, una generación a la vez.
  Dos ordenadores abiertos justo a la vez podrían hacer dos (raro con un usuario); el segundo desfija el primero.

## Alternativas consideradas

- **Tabla propia `reports`:** pantalla e historial propios, migración y tiempo real para algo que una nota ya resuelve (se lee, se busca, se
  sincroniza y la ve el MCP).
- **Generarlo en una Edge Function con cron:** funcionaría con el ordenador apagado, pero sin el modelo local (o con uno en la nube, contra
  «todo local»). La parte fija sí podría hacerse en servidor: si un día se quiere el informe sin ordenador, ese es el camino (otro ADR).
- **Generar el de los días que faltan al encender:** informes viejos que nadie leerá; uno por día, el de hoy.
- **Que lo escriba entero el modelo:** más bonito, pero con un 8B se cuelan errores en cifras y fechas; los datos van fijos.
- **Activado por defecto:** crearía notas sin que el usuario lo haya pedido.

## Consecuencias

- Sin abrir Muninn en el ordenador ese día no hay informe; en el iPhone se ve el último.
- Las notas de informes se acumulan (una por día): se pueden archivar a mano; si molestan, un ajuste de «archivar los de más de N días».
- Relacionado: `packages/assistant/src/report.ts`, `apps/web/src/lib/morning-report*.ts`, `apps/web/src/shell/MorningReportRunner.tsx`.
