# Pruebas en un iPhone real

Lista corta para pasar **a mano** antes de dar por cerrada la F1. Es la primera parte de la pila [Pruebas finales](ROADMAP.md#pruebas-finales) del ROADMAP. El navegador de desarrollo simula clics, no gestos
táctiles ni el teclado de iOS, así que esto no se puede verificar desde el ordenador. Necesitas un iPhone con iOS 16.4 o
superior, la app publicada o un servidor de desarrollo accesible desde el móvil, y una cuenta (no el modo demo).

**Cómo anotar un fallo:** la pantalla, qué hiciste, qué esperabas y la versión de iOS. Si algo falla, abre una tarea en el
proyecto de Muninn con la etiqueta `iphone`.

## 1. Instalar

| Qué hacer | Esperado |
|---|---|
| En Safari: **Compartir › Añadir a pantalla de inicio**, y abrir el icono | Se abre sin barras de Safari, con el fondo oscuro de Muninn |
| Entrar con el código del correo | Entras y la sesión sigue al cerrar y abrir la app |

## 2. Campos y teclado

| Qué hacer | Esperado |
|---|---|
| Tocar el buscador de Notas, el filtro del tablero, «Añadir tarea» y el título de una tarea | La página **no se amplía** al enfocar (los campos miden 16 px) |
| Notas › **+** › escribir título › Intro | El cursor pasa al texto sin cerrar el teclado |
| Con el teclado abierto, pulsar **B**, la lista o la casilla de la barra de arriba | Se aplica el formato y **el teclado no se cierra** |
| Escribir una lista con `- ` y pulsar Intro | La línea siguiente ya empieza con su viñeta; Intro sobre una viñeta vacía termina la lista |
| Agitar el móvil (deshacer) tras pulsar un botón de formato | Deshace el formato (si no lo hace, anótalo: es el deshacer nativo del campo) |
| Escribir hasta el final de una nota larga con el teclado abierto | La línea que escribes **no queda tapada** por el teclado |
| Escribir, bloquear la pantalla y volver a la app | El texto está guardado («Guardado» arriba) |
| Vista previa y marcar una casilla de tarea | Se marca y se guarda |

## 3. Tablero con el dedo

| Qué hacer | Esperado |
|---|---|
| Desplazar la lista de tarjetas en vertical | Hace scroll, sin arrastrar tarjetas |
| **Mantener pulsada** una tarjeta (~¼ s) y moverla | Se levanta; el scroll de la página no se mueve a la vez |
| Soltarla sobre **otra pestaña** de columna | Cambia de columna y avisa con «Deshacer» |
| Soltarla sobre otra tarjeta de la misma columna | Se reordena |
| **Deslizar a la izquierda** una tarjeta (más de ~100 px) | Se completa («Hecho» verde debajo) y avisa con «Deshacer» |
| Un deslizamiento corto o en diagonal | No hace nada y la tarjeta vuelve |
| Tocar una tarjeta | Abre el detalle a pantalla completa |
| Activar un filtro (embudo) y arrastrar una tarjeta | La tarjeta cae donde la soltaste; al quitar el filtro el orden es el esperado |

## 4. Pestañas y pantalla

| Qué hacer | Esperado |
|---|---|
| Cambiar de pestaña | La pestaña activa se colorea; las cuatro tienen su nombre |
| Bajar por Inicio y volver a subir | La barra se encoge a la pestaña activa y vuelve entera al subir; encogida, un toque la despliega |
| Tocar el botón con el logo | Abre el Asistente; el campo de escribir queda por encima de la barra |
| La barra respecto al borde de abajo | Respeta la barra de gestos del iPhone (no la tapa) |
| Ajustes › Módulos: desactivar Finanzas | Quedan 3 pestañas que se reparten el ancho |
| Cerrar la app del todo y abrirla en Inicio (con pocos datos) | La barra está pegada abajo desde el primer momento, sin hueco debajo |
| Inicio con títulos de tarea largos | Nada se sale por la derecha; los títulos ocupan hasta dos líneas |
| iPad en vertical y en horizontal | En vertical, raíl de iconos con tooltips; en horizontal, la barra lateral completa |
| Hacer algo que muestre un aviso (archivar y deshacer) | La píldora sale entera bajo la isla, sin taparse |
| Ajustes desde **Más › Todos los ajustes** | Una lista de secciones; cada una se abre y vuelve con «‹ Ajustes» |
| Finanzas › Movimientos: el botón de filtro | Se abre una hoja con tipo, categorías y cuenta; la búsqueda y el botón caben en una línea |

## 5. Sin conexión y tiempo real

| Qué hacer | Esperado |
|---|---|
| Abrir la app con datos y activar el **modo avión** | Sigue mostrando lo último que viste y aparece «Sin conexión · solo lectura» |
| Con el modo avión, cambiar algo (mover una tarjeta, marcar una casilla) | Avisa de que no hay conexión y lo deja como estaba |
| Cerrar la app del todo, con el modo avión, y volver a abrirla | Abre con los datos guardados (puede tardar un par de segundos) |
| Desactivar el modo avión | «Conexión recuperada» y se actualiza sola |
| Con el iPhone y el ordenador abiertos, mover una tarea en uno | Se mueve en el otro en uno o dos segundos |

## 6. Documentación

| Qué hacer | Esperado |
|---|---|
| Más › Documentación › abrir una guía con tablas | La tabla se desplaza en horizontal si no cabe; la página no |
| Pulsar un enlace a otra guía | Abre esa guía; atrás vuelve a la anterior |
