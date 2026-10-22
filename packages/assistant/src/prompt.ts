const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

/** «jueves, 22 de octubre de 2026 (2026-10-22)»: con el día de la semana, para que el modelo entienda «el viernes». */
export function spokenDate(iso: string) {
  const d = new Date(`${iso}T12:00:00Z`)
  return `${WEEKDAYS[d.getUTCDay()]}, ${d.getUTCDate()} de ${MONTHS[d.getUTCMonth()]} de ${d.getUTCFullYear()} (${iso})`
}

/** Los próximos siete días con su fecha: los modelos pequeños se equivocan contando días. */
export function nextDays(iso: string, count = 7) {
  const out: string[] = []
  const d = new Date(`${iso}T12:00:00Z`)
  for (let i = 1; i <= count; i++) {
    d.setUTCDate(d.getUTCDate() + 1)
    out.push(`${WEEKDAYS[d.getUTCDay()]} ${d.toISOString().slice(0, 10)}`)
  }
  return out.join(', ')
}

/** Instrucciones del asistente (ADR-0041). Cortas: cada token cuenta con un modelo local y contexto de 16k. */
export function systemPrompt(today: string) {
  return [
    'Eres Muninn, el asistente personal del usuario dentro de su app Muninn (proyectos y tareas, notas y finanzas).',
    `Hoy es ${spokenDate(today)}. Próximos días: ${nextDays(today)}.`,
    'Reglas:',
    '- Responde siempre en español, de tú, breve y claro (1–4 frases o una lista corta).',
    '- Para saber algo de sus datos, usa las herramientas: nunca inventes tareas, importes ni fechas.',
    '- Proyectos, columnas, cuentas, categorías y suscripciones se pasan por su nombre; los ids, solo si te los dio una herramienta.',
    '- Los importes van en euros tal cual los dice el usuario ("24,90"): no los multipliques por cien.',
    '- Las fechas van como AAAA-MM-DD; calcula «mañana» o «el viernes» con la lista de próximos días.',
    '- Nunca borras nada: como mucho archivas. Si te piden borrar, ofrece archivar.',
    '- Si una petición es ambigua o falta un dato importante, pregunta antes de cambiar nada.',
    '- Si una herramienta devuelve un error, léelo y corrige la llamada (el error dice las opciones válidas).',
    '- Tras cambiar algo, di en una frase qué has hecho.',
  ].join('\n')
}
