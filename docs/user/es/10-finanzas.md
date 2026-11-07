---
title: Finanzas
description: Tus cuentas, gastos, ingresos y ahorro, con el saldo siempre al día.
order: 10
status: parcial
group: modulos
icon: finance
---

# Finanzas

> **Estado:** ya puedes crear cuentas, apuntar gastos, ingresos, ahorro e inversión, ver el saldo de cada cuenta y llevar tus
> suscripciones con aviso antes de cada cobro. Todavía no hay importación del banco: los movimientos se apuntan a mano (o
> pidiéndoselo al asistente).

## Activarlo

Finanzas es un módulo: si no lo ves en el menú, ve a **Ajustes › Módulos** y activa **Finanzas**. Desactivarlo solo lo esconde;
tus datos siguen ahí.

## Cuentas

Empieza creando tus cuentas en la pestaña **Cuentas** (o con el botón que sale la primera vez):

- **Corriente**, **Efectivo** u **Otra**: el dinero del día a día.
- **Ahorro**: una hucha. Puedes ponerle un **objetivo** y verás cuánto llevas («Objetivo 12.000 € · 78 %»).
- **Inversión**: un fondo o una cartera.

El **saldo inicial** es lo que hay hoy en la cuenta. Si empieza en negativo (un descubierto), marca la casilla. A partir de ahí,
**el saldo se calcula solo** con los movimientos: no hay que tocarlo nunca a mano.

## Apuntar un movimiento

Pulsa **Movimiento** (en el ordenador, en la pestaña **Movimientos**, el formulario está siempre a la derecha) y elige el tipo:

| Tipo | Qué hace |
|---|---|
| **Gasto** | Resta de la cuenta. Elige una categoría (Supermercado, Ocio…). |
| **Ingreso** | Suma a la cuenta (Nómina, Facturas…). |
| **Ahorro** | Pasa dinero de una cuenta a tu hucha. |
| **Inversión** | Pasa dinero de una cuenta a tu cuenta de inversión. |
| **Traspaso** | Pasa dinero entre dos cuentas cualesquiera (del banco al efectivo, por ejemplo). |

El importe admite coma o punto («24,90») y se guarda al céntimo exacto. La fecha es hoy salvo que elijas otra.

Al guardar sale un aviso con **Deshacer**, por si te equivocas.

## Ver y buscar

- **Resumen**: el mes de un vistazo. Cambia de mes con las flechas, o pulsa el nombre del mes para saltar a cualquier mes y año:
  - **Ingresos** y **gastos**, comparados con el mes anterior en porcentaje. Si el anterior casi no tenía datos (por ejemplo, el
    primer mes que apuntas), en vez de un porcentaje enorme verás cuánto hubo: «En septiembre: 9,95 €».
  - **Ahorro** e **inversión**: lo que pasaste ese mes a tus huchas y a tus cuentas de inversión (si sacaste, resta).
  - **Tasa de ahorro**: la parte de lo que entró que **no gastaste** ((ingresos − gastos) ÷ ingresos). Incluye lo que apartaste y lo
    que se quedó en la cuenta; **Libre** dice cuánto se quedó sin apartar.
  - **En qué se va el dinero** (gasto por categoría) y los **últimos 6 meses** de ingresos y gastos (pasa el ratón por una barra para
    ver las cifras).
  - Tus cuentas con su saldo, tus suscripciones y los últimos movimientos.
- **Movimientos**: los del mes, agrupados por día y con el total de cada día. Cambia de mes igual que en el Resumen y filtra por texto,
  tipo, categoría o cuenta. En el móvil, el tipo, la categoría y la cuenta están tras el botón de filtro (el embudo), junto a la
  búsqueda. Si filtras una cuenta, los traspasos salen con signo: lo que sale (−) y lo que entra (+).
  El texto busca en el concepto y en la nota, sin importar mayúsculas ni tildes; si escribes varias palabras, salen los movimientos
  que las tienen todas, en el orden que sea («leche café» encuentra «Café con leche»).

## Editar y archivar

Toca un movimiento para cambiar cualquier dato o **archivarlo**. Archivar lo quita de los saldos y de la lista, pero no lo borra:
el aviso tiene **Deshacer**. Lo mismo con las cuentas y las categorías (en **Cuentas**): una cuenta archivada deja de verse y sus
movimientos se conservan; una categoría archivada deja de ofrecerse, pero los movimientos antiguos la siguen mostrando.

## Categorías

Empiezas con unas de serie (Vivienda, Supermercado, Suscripciones, Transporte, Restaurantes, Ocio, Salud, Otros; y Nómina,
Facturas y Otros ingresos). En **Cuentas** puedes renombrarlas, cambiarles el color, archivarlas o crear las tuyas.

Para **ordenarlas** a tu gusto, arrástralas por el asa de la izquierda (⠿). Con el teclado: ve al asa con Tab, pulsa Espacio o
Enter, muévela con las flechas y vuelve a pulsar para soltarla. Gastos e ingresos se ordenan por separado, y en ese orden te salen
al apuntar un movimiento y en los filtros. Sale un aviso con **Deshacer**.

## Suscripciones

En la pestaña **Suscripciones** apuntas lo que pagas cada semana, mes o año (Spotify, el gimnasio, un dominio): nombre, importe,
cuenta, categoría, próximo cobro y cuántos días antes quieres el aviso (3 por defecto). Verás cuánto suman al mes y al año.

Cuando se acerca un cobro, sale en **Próximos cobros**, en Inicio y en Finanzas, y si activaste los avisos te llega uno al móvil
([Notificaciones](13-notificaciones.md)):

- **Apuntar** lo guarda como gasto (con un icono de repetición en la lista) y pasa la suscripción al siguiente periodo.
- **Saltar** pasa al siguiente periodo sin apuntar nada (ese mes no te cobraron).

Los dos tienen **Deshacer**. **Muninn nunca apunta un cobro solo**: no está conectado a tu banco y no sabe si al final te lo cobraron,
si cambió el precio o si cancelaste. Si no abres la app, el cobro se queda como «vencido» hasta que lo apuntes o lo saltes.

Atajo: al apuntar un gasto, marca **Repetir cada mes (suscripción)** y se crea la suscripción con ese primer cobro ya apuntado.

Una suscripción que ya no pagas se **archiva** (deja de avisar; sus cobros apuntados se conservan).

## Con el asistente

Si tienes un asistente conectado ([Conectar Claude y otros](06-asistentes-ia.md)), puedes decirle «He gastado 24,90 en el cine» o
«¿Cuánto tengo en la hucha?», «¿Cómo voy este mes?», y también «¿Qué suscripciones me cobran esta semana?» o «Apunta el cobro de Spotify». Tampoco
puede borrar nada: como mucho, archivar.

## Lo que aún no hay

- Importar los movimientos del banco (CSV de Imagin) o conectarlo directamente.
- Más de una moneda: todo va en euros.
- Apuntar que una inversión ha subido o bajado de valor: de momento, apúntalo como un ingreso o un gasto en esa cuenta.
