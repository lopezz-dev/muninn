# ADR-0053: Ajustes por grupos, con buscador, marca de «cambiado» y «Restablecer» con Deshacer

- **Estado:** Aceptado
- **Fecha:** 2026-10-28
- **Área:** web, ui

## Contexto

Ajustes era una lista plana de ocho secciones con filas sin jerarquía. Con más ajustes (Asistente, informe de la mañana,
GitHub) costaba encontrar cada cosa, no se veía qué habías cambiado y no había forma de volver a los valores de fábrica.
huginnDB resolvió lo mismo en sus preferencias (grupos, buscador, cabecera común, tarjetas con título, marca de cambiado
y «Reset section»), y queremos esa estructura adaptada a Muninn.

## Decisión

- **Menú por grupos** (Tú, Espacio de trabajo, Asistente, Integraciones, Datos) en `screens/ajustes/sections.ts`, con
  «Acerca de Muninn» al pie. Al lado de cada sección, un dato que ya está en la caché (con qué entras, «2 de 5» módulos,
  la hora del informe…), nunca una petición nueva por pintar el menú.
- «Asistente e IA» se parte en **Modelo local** (`/ajustes/asistente`) e **Informe de la mañana** (`/ajustes/informe`).
  «Integraciones» pasa a llamarse **GitHub** (la ruta sigue siendo `/ajustes/integraciones`).
- **Misma cabecera** en todas las secciones: icono en su color, título y para qué es. **Tarjetas** de cristal con un
  subtítulo en mayúsculas pequeñas, y **filas** con icono, nombre, descripción y control.
- **Buscador** (`lib/settings-search.ts`): un índice de ajustes escrito a mano, con el `id` de su fila. Los resultados
  sustituyen a la sección y **solo llevan**: el ajuste se cambia en su fila (`#ajuste-<id>`, que se centra y se resalta).
  No se pintan copias de los controles en los resultados. Atajo `/`, como en la Documentación.
- **«Cambiado»** (`lib/settings-changes.ts`) solo para **preferencias con un valor de fábrica claro**: cristal, acento,
  informe activado y su hora. Los módulos, la dirección de Ollama y el modelo son configuración de tu equipo: no llevan
  punto ni se restablecen.
- **Restablecer** (una fila o la sección entera) no pide confirmación: aplica, avisa con `notify` y ofrece «Deshacer»,
  como el resto de la app. Es la diferencia a propósito con huginnDB, que pregunta en un diálogo.
- **Anchura**: las tarjetas tienen un tope de 820 px. Una fila de ajuste estirada a 1.600 px separa tanto el nombre del
  control que cuesta leerla. En pantallas `2xl` el sitio sobrante lo ocupa «En la documentación», con la guía de la
  sección. Es una excepción acotada a [ADR-0048](0048-pantallas-a-todo-el-ancho-y-alto.md), del mismo tipo que la medida
  de lectura que ese ADR ya mantiene.

## Alternativas consideradas

- **Restablecer con un diálogo de confirmación**, como huginnDB: va contra la regla de la app (acciones que cambian datos
  ofrecen Deshacer, no diálogos) y los valores afectados son pocos y se recuperan con un clic.
- **Marca de «cambiado» en todo**, módulos incluidos: «Restablecer módulos» te dejaría sin Finanzas o sin GitHub por
  tocar un botón pensado para la apariencia. El valor de fábrica de un módulo no es «el bueno».
- **Generar el índice del buscador recorriendo las filas pintadas**: obligaría a montar todas las secciones para buscar.
  El índice a mano es pequeño y un test comprueba que cada entrada apunta a una sección que existe.
- **Tarjetas a todo el ancho** (ADR-0048 al pie de la letra): las filas pierden la relación nombre-control.

## Consecuencias

- Positivas: se encuentra un ajuste escribiendo, se ve de un vistazo qué has cambiado y se vuelve atrás sin miedo.
- Negativas / costes: un ajuste nuevo hay que darlo de alta en `SETTINGS_INDEX` (y, si tiene valor de fábrica, en
  `changedPrefs`) para que el buscador y la marca lo vean. Los enlaces a `/ajustes/asistente` que buscaban el informe
  apuntan ahora a `/ajustes/informe`.
- Relacionado: [ADR-0019](0019-feedback-con-notificaciones.md) (avisos y Deshacer), [ADR-0043](0043-informe-de-la-manana-en-local.md),
  [gotchas/web](../gotchas/web.md#ajustes-un-ajuste-nuevo-se-da-de-alta-en-dos-sitios), `apps/web/src/screens/ajustes/`.
