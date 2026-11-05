import {
  type AccountSession,
  type AppSessions,
  groupSessions,
  sessionDeviceLabel,
} from '@muninn/core'
import { Button, Dialog, DialogContent, IconButton, icons, notify, TextField } from '@muninn/ui'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { timeAgo } from '../../lib/dates'
import { rememberDeviceName } from '../../lib/device-name'
import { notifyUndo } from '../../lib/feedback'
import { useAuth, useMuninn } from '../../lib/muninn'
import { fail } from '../../lib/mutations'
import { keys } from '../../lib/queries'
import { useEndSession } from '../../lib/session'
import { PrefGroup, PrefRow } from './ui'

/**
 * Seguridad de la cuenta en Ajustes › Cuenta (ADR-0061). Cerrar una sesión no se puede deshacer (solo volviendo a
 * entrar en ese dispositivo): en lugar de «Deshacer», el aviso dice qué pasa.
 */

/**
 * Ponerle nombre a una sesión («Portátil del curro», ADR-0082): en el navegador no se puede saber qué equipo es. El de
 * este dispositivo, además, lo recuerda el navegador para la próxima vez que entres. Con «Deshacer».
 */
function RenameDialog({
  session,
  open,
  onOpenChange,
}: {
  session: AccountSession
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation('security')
  const m = useMuninn()
  const qc = useQueryClient()
  const [value, setValue] = useState(session.deviceName ?? '')
  const [busy, setBusy] = useState(false)

  const apply = async (name: string | null, undoing = false): Promise<boolean> => {
    let before: string | null
    try {
      before = await m.account.sessions.rename(session.id, name)
    } catch (err) {
      fail(t('sessions.renameFailed'), err)
      return false
    } finally {
      void qc.invalidateQueries({ queryKey: keys.accountSessions })
    }
    const saved = name?.trim() || null
    if (session.current) rememberDeviceName(saved)
    if (!undoing)
      notifyUndo(saved ? t('sessions.renamed', { name: saved }) : t('sessions.nameRemoved'), {
        icon: 'edit',
        undo: () => apply(before, true),
      })
    return true
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    if (await apply(value)) onOpenChange(false)
    setBusy(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) setValue(session.deviceName ?? '')
        onOpenChange(o)
      }}
    >
      <DialogContent
        title={t('sessions.renameTitle')}
        description={t('sessions.renameDescription', {
          device: sessionDeviceLabel(session.userAgent, session.appName),
        })}
      >
        <form onSubmit={(e) => void save(e)} className="flex flex-col gap-4">
          <TextField
            label={t('sessions.nameLabel')}
            hint={session.current ? t('sessions.nameHintHere') : t('sessions.nameHint')}
            placeholder={t('sessions.namePlaceholder')}
            value={value}
            maxLength={40}
            autoFocus
            onChange={(e) => setValue(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" onClick={() => onOpenChange(false)}>
              {t('sessions.cancel')}
            </Button>
            <Button type="submit" variant="primary" disabled={busy}>
              {t('sessions.saveName')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function SessionRow({ session }: { session: AccountSession }) {
  const { t } = useTranslation('security')
  const m = useMuninn()
  const qc = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const kind = sessionDeviceLabel(session.userAgent, session.appName)
  const label = session.deviceName ?? kind
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
    session.deviceName ? kind : null,
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
      <div className="flex items-center gap-1">
        <IconButton
          aria-label={t('sessions.renameOf', { device: label })}
          icon={<icons.edit size={16} />}
          size="sm"
          onClick={() => setRenaming(true)}
        />
        {session.current ? null : (
          <Button size="sm" onClick={() => void revoke()} disabled={busy}>
            {busy ? t('sessions.signingOut') : t('sessions.signOut')}
          </Button>
        )}
      </div>
      <RenameDialog session={session} open={renaming} onOpenChange={setRenaming} />
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
