import {
  type AccountSession,
  type AppSessions,
  groupSessions,
  sessionDeviceLabel,
} from '@muninn/core'
import { Button, notify } from '@muninn/ui'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
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

function SessionRow({ session }: { session: AccountSession }) {
  const { t } = useTranslation('security')
  const m = useMuninn()
  const qc = useQueryClient()
  const [busy, setBusy] = useState(false)
  const label = sessionDeviceLabel(session.userAgent, session.appName)
  const revoke = async () => {
    setBusy(true)
    try {
      await m.account.sessions.revoke(session.id)
      notify.success(t('sessions.signedOut', { device: label }), {
        icon: 'user',
        description: t('sessions.leavesSoon'),
      })
    } catch (err) {
      fail(t('sessions.signOutFailed'), err)
    }
    setBusy(false)
    void qc.invalidateQueries({ queryKey: keys.accountSessions })
  }
  const details = [
    session.current
      ? t('sessions.activeNow')
      : t('sessions.lastActive', { time: timeAgo(session.lastActiveAt) }),
    t('sessions.signedIn', { time: timeAgo(session.createdAt) }),
    session.ip,
    session.aal === 'aal2' ? t('sessions.withSecondFactor') : null,
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
              {t('sessions.thisOne')}
            </span>
          ) : null}
        </>
      }
      description={details.join(' · ')}
    >
      {session.current ? null : (
        <Button size="sm" onClick={() => void revoke()} disabled={busy}>
          {busy ? t('sessions.signingOut') : t('sessions.signOut')}
        </Button>
      )}
    </PrefRow>
  )
}

/**
 * Todas las sesiones de una app conectada (claude.ai, Claude Code…) en una fila (ADR-0081): cada reconexión abre una
 * sesión nueva y, una a una, eran filas iguales que no decían nada. «Cerrar todas» las cierra; para que la app no
 * vuelva a entrar está «Quitar acceso» en Apps con acceso.
 */
function AppSessionsRow({ group }: { group: AppSessions }) {
  const { t } = useTranslation('security')
  const m = useMuninn()
  const qc = useQueryClient()
  const [busy, setBusy] = useState(false)
  const label = sessionDeviceLabel(null, group.appName)
  const revokeAll = async () => {
    setBusy(true)
    try {
      for (const s of group.sessions) await m.account.sessions.revoke(s.id)
      notify.success(t('sessions.appSignedOut', { device: label }), {
        icon: 'user',
        description: t('sessions.appSignedOutHint'),
      })
    } catch (err) {
      fail(t('sessions.signOutFailed'), err)
    }
    setBusy(false)
    void qc.invalidateQueries({ queryKey: keys.accountSessions })
  }
  return (
    <PrefRow
      icon="link"
      title={label}
      description={t('sessions.appSessions', {
        count: group.sessions.length,
        time: timeAgo(group.lastActiveAt),
      })}
    >
      <Button size="sm" onClick={() => void revokeAll()} disabled={busy}>
        {busy
          ? t('sessions.signingOut')
          : group.sessions.length > 1
            ? t('sessions.signOutAll')
            : t('sessions.signOut')}
      </Button>
    </PrefRow>
  )
}

/** Dónde está abierta la sesión, y cerrarla en uno, en los demás o en todos. */
export function Sesiones() {
  const { t } = useTranslation('security')
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
      notify.success(t('sessions.othersDone'), {
        icon: 'user',
        description: t('sessions.othersDoneHint'),
      })
    } catch (err) {
      fail(t('sessions.othersFailed'), err)
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
    <PrefGroup title={t('sessions.title')} icon="devices" description={t('sessions.description')}>
      <div id="ajuste-sesiones">
        {sessions.isPending ? (
          <p className="px-4 py-3.5 text-sm text-fg-subtle md:px-[18px]">{t('loading')}</p>
        ) : sessions.isError ? (
          <p className="px-4 py-3.5 text-sm text-danger md:px-[18px]">{t('sessions.loadError')}</p>
        ) : (
          (() => {
            const { devices, apps } = groupSessions(sessions.data)
            return (
              <>
                {devices.map((s) => (
                  <SessionRow key={s.id} session={s} />
                ))}
                {apps.map((g) => (
                  <AppSessionsRow key={g.appName} group={g} />
                ))}
              </>
            )
          })()
        )}
      </div>
      <PrefRow
        id="cerrar-sesiones"
        icon="signOut"
        title={t('sessions.othersTitle')}
        description={t('sessions.othersDescription')}
      >
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            size="sm"
            onClick={() => void closeOthers()}
            disabled={busy !== null || others === 0}
          >
            {busy === 'others' ? t('sessions.signingOut') : t('sessions.others')}
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => void closeAll()}
            disabled={busy !== null}
          >
            {busy === 'global' ? t('sessions.signingOut') : t('sessions.everywhere')}
          </Button>
        </div>
      </PrefRow>
    </PrefGroup>
  )
}
