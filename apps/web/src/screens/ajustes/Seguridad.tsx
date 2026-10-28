import { type AccountSession, sessionDeviceLabel } from '@muninn/core'
import { Button, notify } from '@muninn/ui'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { timeAgo } from '../../lib/dates'
import { useAuth, useMuninn } from '../../lib/muninn'
import { fail } from '../../lib/mutations'
import { keys } from '../../lib/queries'
import { useEndSession } from '../../lib/session'
import { PrefGroup, PrefRow } from './ui'

/**
 * Seguridad de la cuenta en Ajustes › Cuenta (ADR-0061). Cerrar una sesión no se puede deshacer (solo volviendo a
 * entrar en ese dispositivo): en lugar de «Deshacer», el aviso dice qué pasa.
 */

const LEAVES_SOON = 'Saldrá en menos de una hora. Para volver, tendrá que entrar de nuevo.'

function SessionRow({ session }: { session: AccountSession }) {
  const m = useMuninn()
  const qc = useQueryClient()
  const [busy, setBusy] = useState(false)
  const label = sessionDeviceLabel(session.userAgent)
  const revoke = async () => {
    setBusy(true)
    try {
      await m.account.sessions.revoke(session.id)
      notify.success(`Sesión cerrada en «${label}»`, { icon: 'signOut', description: LEAVES_SOON })
    } catch (err) {
      fail('No se pudo cerrar la sesión', err)
    }
    setBusy(false)
    void qc.invalidateQueries({ queryKey: keys.accountSessions })
  }
  const details = [
    session.current ? 'Activa ahora' : `Última actividad ${timeAgo(session.lastActiveAt)}`,
    `entraste ${timeAgo(session.createdAt)}`,
    session.ip,
    session.aal === 'aal2' ? 'con segundo factor' : null,
  ].filter(Boolean)
  return (
    <PrefRow
      icon="devices"
      tile={session.current ? 'bg-accent-soft text-accent' : undefined}
      title={
        <>
          {label}
          {session.current ? (
            <span className="rounded-xs bg-accent-soft px-1.5 py-px text-2xs font-semibold text-accent">
              Este
            </span>
          ) : null}
        </>
      }
      description={details.join(' · ')}
    >
      {session.current ? null : (
        <Button size="sm" onClick={() => void revoke()} disabled={busy}>
          {busy ? 'Cerrando…' : 'Cerrar'}
        </Button>
      )}
    </PrefRow>
  )
}

/** Dónde está abierta la sesión, y cerrarla en uno, en los demás o en todos. */
export function Sesiones() {
  const m = useMuninn()
  const auth = useAuth()
  const qc = useQueryClient()
  const endSession = useEndSession()
  const sessions = useQuery({
    queryKey: keys.accountSessions,
    queryFn: () => m.account.sessions.list(),
    enabled: m.account.available(),
  })
  const [busy, setBusy] = useState<'others' | 'global' | null>(null)
  const others = sessions.data?.filter((s) => !s.current).length ?? 0

  const closeOthers = async () => {
    setBusy('others')
    try {
      await m.account.sessions.signOut('others')
      notify.success('Sesión cerrada en los demás dispositivos', {
        icon: 'signOut',
        description: 'Saldrán en menos de una hora. En este sigues dentro y tus datos no cambian.',
      })
    } catch (err) {
      fail('No se pudo cerrar la sesión en los demás dispositivos', err)
    }
    setBusy(null)
    void qc.invalidateQueries({ queryKey: keys.accountSessions })
  }
  const closeAll = async () => {
    setBusy('global')
    await endSession(auth.kind, true)
    setBusy(null)
  }

  if (!m.account.available()) return null
  return (
    <PrefGroup
      title="Sesiones y dispositivos"
      icon="devices"
      description="Dónde tienes la sesión abierta. Cierra las que no reconozcas."
    >
      <div id="ajuste-sesiones">
        {sessions.isPending ? (
          <p className="px-4 py-3.5 text-sm text-fg-subtle md:px-[18px]">Cargando…</p>
        ) : sessions.isError ? (
          <p className="px-4 py-3.5 text-sm text-danger md:px-[18px]">
            No se pudo cargar la lista de sesiones.
          </p>
        ) : (
          sessions.data.map((s) => <SessionRow key={s.id} session={s} />)
        )}
      </div>
      <PrefRow
        id="cerrar-sesiones"
        icon="signOut"
        title="Cerrar en otros dispositivos"
        description="En todos, también en este: tendrás que volver a entrar aquí."
      >
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            size="sm"
            onClick={() => void closeOthers()}
            disabled={busy !== null || others === 0}
          >
            {busy === 'others' ? 'Cerrando…' : 'En los demás'}
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => void closeAll()}
            disabled={busy !== null}
          >
            {busy === 'global' ? 'Cerrando…' : 'En todos'}
          </Button>
        </div>
      </PrefRow>
    </PrefGroup>
  )
}
