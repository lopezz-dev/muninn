/**
 * Notas reales de Muninn, anonimizadas (nombres, enlaces e importes cambiados), para las pruebas de ida y vuelta del
 * editor (ADR-0078). Cubren lo que de verdad se escribe: títulos, listas anidadas, tareas, tablas con negritas y
 * enlaces, código, citas, HTML suelto, imágenes y caracteres que Markdown escapa.
 */
export const NOTES_CORPUS: Record<string, string> = {
  planificacion: `Calendario hecho el 03-11-2026. Muninn solo guarda la **fecha de entrega** de cada tarjeta; el **inicio** está en esta tabla. ✅ = hecho.

**Cómo salen las versiones.** release-please sobre \`main\` (\`bump-minor-pre-major\`): cada \`feat\` sube la menor (0.8 → 0.9). Última publicada: **v0.10.0** (05-11-2026).

**Reajuste del 04-11-2026:**
- Se mantienen las fechas de noviembre.
- Lo que salió va a su paraguas:
  - Las hojas inferiores no se cierran arrastrando: va a «Arreglos (0.10)».
  - El conector se invalidó: va a «Pruebas: F2 · MCP remoto», punto 4.
- PR #128 (https://example.com/pull/128), fusionada en \`develop\`.

| Inicio | Entrega | Tarjeta | Versión |
| --- | --- | --- | --- |
| **03-11-2026** | | ✅ **Corte 0.9.0**: #120 y #121 fusionadas | 0.9 |
| 04-11-2026 | 13-11-2026 | Seguridad: identificar dispositivos (#133, #134) y [aviso](https://example.com/a) | 0.10 |

Reglas del plan:
- **Una versión menor por bloque de trabajo**, en viernes.
- La 1.0.0 se fuerza con \`"release-as": "1.0.0"\` en \`release-please-config.json\`.
`,
  receta: `# Lentejas de la abuela

Para 4 personas. *Mejor de un día para otro.*

## Ingredientes

- 300 g de lentejas pardinas
- 1 chorizo
- 2 zanahorias

## Pasos

1. Remojar 2 h (opcional).
2. Sofreír la cebolla y el pimiento.
   - Que no se queme el ajo.
3. Añadir todo y cocer **40 min**.

> Truco: un chorrito de vinagre al final.
`,
  compra: `Lista de la compra

- [ ] Leche
- [x] Pan
- [ ] Café *descafeinado*
  - [ ] De cápsulas
- [x] ~~Huevos~~ (había)
`,
  tecnica: `## Desplegar la función

\`\`\`bash
supabase functions deploy mcp --no-verify-jwt
\`\`\`

Luego comprobar con \`curl -i -X POST https://example.supabase.co/functions/v1/mcp\`: tiene que dar **401**.

\`\`\`
sin lenguaje
  con sangría
\`\`\`

Ojo con \`<script>\` y con el 50 % de *ahorro* *no* aplicable.
`,
  rara: `Texto con <b>HTML en línea</b> y una imagen ![logo de prueba](https://example.com/logo.png "Título") en medio.

<div align="center">
  bloque <em>html</em>
</div>

Línea con salto duro  
y la siguiente.

---

Precio: 3 * 4 = 12 € y un guion_bajo_suelto, un #hashtag y 1. no es lista.
`,
  vacia: '',
}
