# ADR-0034: Escribir sin conexión con una cola de intenciones persistente e ids generados en el cliente

- **Estado:** Propuesto (preguntas abiertas respondidas el 21 de octubre; falta leerlo entero antes de aceptarlo; no hay código)
- **Fecha:** 2026-10-19
- **Área:** web, core
- **Reemplazaría a:** la parte «sin red, solo lectura» de [ADR-0029](0029-tiempo-real-y-cache-sin-conexion.md) (el tiempo real y la caché de
  lectura siguen igual)

## Contexto

Hoy, sin red, Muninn se abre y se consulta, pero toda escritura falla, se deshace y avisa «Sin conexión»
([ADR-0029](0029-tiempo-real-y-cache-sin-conexion.md)). En el iPhone (metro, avión) eso significa no poder ni apuntar una tarea. Las
escrituras ya son optimistas y van en cola por clave ([ADR-0025](0025-escrituras-optimistas-y-deshacer.md)), pero esa cola vive en memoria
y se pierde al cerrar la app. Problemas a resolver: ids de lo creado sin red, orden con fractional indexing
([ADR-0006](0006-orden-con-fractional-indexing.md)) frente a cambios de otros dispositivos, conflictos y «Deshacer» sobre lo que aún no se ha enviado.

## Decisión propuesta

1. **Una cola de intenciones persistente** en IndexedDB (`muninn-queue`, clave por usuario, como la caché de `lib/offline.ts`). Cada entrada es
   la **llamada al core** que haría la acción (`{ id, op: 'tasks.move', args, key, createdAt, base }`), no un parche de filas: al volver la red
   se reproducen **en orden y por la misma API** (`createMuninn`), así las reglas (completedAt, actividad, cola de GitHub de
   [ADR-0031](0031-sync-github-issues-tareas.md)) se aplican igual. Con red, la cola se vacía al momento y todo funciona como hoy.
2. **Ids generados en el cliente, no provisionales.** Las entradas de creación llevan ya su UUID (`crypto.randomUUID()`): el core aceptará un
   `id` opcional en `create*` y el store lo usará en el `insert`. No hay que traducir ids provisionales a reales, y lo que se crea sin red se
   puede abrir, editar y mover sin red con su id definitivo. Reenviar una creación ya aplicada (el `insert` choca con la clave primaria) cuenta
   como hecha: la cola es idempotente.
3. **Orden: se guarda la intención, no la clave.** Un movimiento en cola guarda «en la columna C, debajo de la tarea X» (o «arriba del todo»),
   no la clave de orden ni el índice. Al reproducirlo, el core calcula la clave con los vecinos **de ese momento**. Si otro dispositivo movió o
   archivó X, la tarjeta cae al final de C (o al principio si era «arriba»). Fractional indexing ya hace que solo se reescriba la tarjeta movida,
   así que los cambios de otros dispositivos no se pisan.
4. **Conflictos, campo a campo y sin perder nada:**
   - Cada `update` en cola lleva solo los campos cambiados y el `updatedAt` que se vio al editar (`base`). Si al reproducirlo la fila tiene un
     `updatedAt` posterior **y** cambió ese mismo campo (se mira en `activity`), gana lo de este dispositivo (es lo último que hizo la persona),
     pero se avisa con `notify` y **«Deshacer»** que restaura el valor del servidor. Los conflictos de una misma reproducción se avisan
     **en un solo resumen** («2 cambios se aplicaron sobre otros más recientes»), con un «Deshacer» para todos.
   - **Notas:** si el texto cambió en otro sitio desde `base`, no se sobrescribe: lo escrito sin red se guarda como **nota nueva** («Título
     (sin conexión)») vinculada a lo mismo, y se avisa. Perder un párrafo es peor que tener dos notas.
   - **Destino desaparecido** (tarea archivada o borrada en otro dispositivo, columna borrada): la entrada se descarta y se avisa; si era un
     movimiento a una columna borrada, va a la columna por defecto.
5. **Qué se puede hacer sin red:** crear, editar, mover, completar, reabrir, archivar y restaurar tareas; subtareas; crear, editar y archivar
   notas. **No:** crear o borrar columnas y proyectos, ni cambiar módulos (estructura que otros cambios dan por hecha); esas acciones siguen
   avisando «Necesitas conexión».
6. **«Deshacer» sobre lo pendiente:** si la acción aún está en la cola, «Deshacer» **quita la entrada** (y las que dependen de ella, p. ej. editar
   una tarea creada sin red) en lugar de encolar la inversa; la caché vuelve a como estaba. Si ya se envió, la inversa de siempre.
7. **Reproducir:** al volver la red (`online`), al enfocar la app y cada 30 s con espera creciente si falla. Una sola pestaña reproduce
   (`navigator.locks.request('muninn-queue')`); las demás ven la misma cola. El tiempo real ya espera a que no haya escrituras propias en cola
   (`isBusy`), así que no pisará lo optimista.
8. **Interfaz:** el aviso pasa de «Sin conexión · solo lectura» a «Sin conexión · 3 cambios por enviar». **Cerrar sesión con cambios sin enviar**
   no se hace en silencio: se avisa con la acción «Cerrar sesión igualmente» (sin diálogo, [ADR-0019](0019-feedback-con-notificaciones.md)).
   La cola se borra con el resto de datos del usuario (`forgetUserData`). **Ajustes › Datos** enseña la lista de cambios pendientes (qué y
   cuándo) y deja descartar cada uno.
9. **Caducidad:** una entrada que no se consigue enviar se guarda **7 días**, como la caché sin conexión; pasado ese tiempo se descarta y se
   avisa de cuántas eran.

## Alternativas consideradas

- **Base local-first** (PowerSync, ElectricSQL, RxDB, Replicache): resuelven sincronización y conflictos, pero cambian el backend o añaden un
  servicio, y saltarían `createMuninn` y sus reglas ([ADR-0002](0002-api-de-dominio-unica.md), [ADR-0003](0003-stores-intercambiables-supabase.md)).
- **CRDT** (Yjs, Automerge) para todo: perfecto para texto colaborativo, excesivo para un tablero de un usuario; se podría usar solo para las
  notas si un día se editan a la vez.
- **Ids provisionales** que se cambian al confirmar: obligan a reescribir cada referencia en la cola y en la caché (rutas abiertas, notas
  vinculadas). Con UUID del cliente no hace falta.
- **Background Sync del service worker:** no existe en Safari de iOS, que es justo donde más se necesita.
- **Guardar parches de filas** en lugar de llamadas al core: se saltaría la lógica de dominio y duplicaría el cálculo de orden en el cliente.

## Consecuencias

- Cambios en el core: `id` opcional en las entradas de creación (y en los stores), y que `move` acepte un ancla («debajo de X») además del índice.
- La cola y su reproducción necesitan tests como los de `sync.test.ts` y `offline.test.ts` (IndexedDB simulado), y probarse en un iPhone real
  (modo avión): entrará en la pila «Pruebas finales» del ROADMAP.
- `CACHE_VERSION` sube cuando la caché empiece a incluir lo creado sin red.
- Preguntas abiertas, respondidas el 21 de octubre: los conflictos se resumen en un aviso (punto 4), las entradas caducan a los 7 días
  (punto 9) y la cola se ve en Ajustes › Datos (punto 8). Falta la lectura completa antes de aceptarlo.
- Relacionado: [ADR-0006](0006-orden-con-fractional-indexing.md), [ADR-0025](0025-escrituras-optimistas-y-deshacer.md),
  [ADR-0029](0029-tiempo-real-y-cache-sin-conexion.md), `apps/web/src/lib/offline.ts`, `apps/web/src/lib/mutations.ts`.
