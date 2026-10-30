import { icons, notify } from '@muninn/ui'
import { useEffect, useRef } from 'react'
import { useOnline } from '../lib/use-online'

/** Aviso de «sin conexión» y de «conexión recuperada». Se carga en diferido: solo hace falta si se corta la red. */
export function OfflineNotice() {
  const online = useOnline()
  const was = useRef(online)
  useEffect(() => {
    if (online && !was.current) notify.info('Conexión recuperada', { icon: 'sync' })
    was.current = online
  }, [online])

  if (online) return null
  return (
    <div
      role="status"
      className="glass-raised pointer-events-none fixed right-5 bottom-[calc(env(safe-area-inset-bottom)+132px)] z-40 flex items-center gap-2 rounded-lg border border-border-strong bg-surface-raised px-3 py-2 text-sm text-fg-muted shadow-popover md:bottom-5"
    >
      <icons.warning size={15} className="text-accent" aria-hidden="true" />
      Sin conexión · solo lectura
    </div>
  )
}
