import { notify } from '@muninn/ui'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { isHandheld } from '../lib/assistant-status'
import { useEnabledModules } from '../lib/modules'
import { generateMorningReport } from '../lib/morning-report'
import { nowClock, reportDue, reportPrefs } from '../lib/morning-report-prefs'
import { useMuninn } from '../lib/muninn'
import { settingsQuery } from '../lib/queries'

/** Cada cuánto se mira si toca el informe. */
const EVERY_MS = 60_000

/**
 * Programa el informe de la mañana (ADR-0043) mientras Muninn está abierto en el ordenador. No pinta nada. Va en su
 * propio chunk (lo monta el shell en diferido): con él viaja `@muninn/assistant`, que el arranque no debe cargar.
 */
export function MorningReportRunner() {
  const m = useMuninn()
  const qc = useQueryClient()
  const modules = useEnabledModules()
  const navigate = useNavigate()
  const settings = useQuery(settingsQuery(m)).data
  const busy = useRef(false)
  // En el móvil no: lo prepara el ordenador (y así no se hace dos veces).
  const active = !isHandheld()

  useEffect(() => {
    if (!active) return
    const tick = async () => {
      if (busy.current || !reportDue(reportPrefs(settings), nowClock(), m.today())) return
      busy.current = true
      try {
        const note = await generateMorningReport(m, qc, { modules })
        if (note) {
          notify.success('Tu informe de la mañana está listo', {
            icon: 'assistant',
            // El mismo id que «Hacer ahora»: si coinciden, un solo aviso.
            id: `morning-report-${note.id}`,
            action: {
              label: 'Abrir',
              onClick: () => void navigate({ to: '/notas/$noteId', params: { noteId: note.id } }),
            },
          })
        }
      } catch (err) {
        // Sin red o sin servidor: se reintenta en el siguiente minuto, sin avisar en cada intento.
        console.warn('[informe de la mañana]', err)
      } finally {
        busy.current = false
      }
    }
    void tick()
    const id = setInterval(() => void tick(), EVERY_MS)
    return () => clearInterval(id)
  }, [active, settings, m, qc, modules, navigate])

  return null
}
