import type { PushDevice } from '@muninn/core'
import { Button, IconButton, icons, notify, Switch } from '@muninn/ui'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '../../components/Page'
import { timeAgo } from '../../lib/dates'
import { fail, notifyUndo } from '../../lib/feedback'
import { useAuth, useMuninn } from '../../lib/muninn'
import {
  browserSubscription,
  currentSupport,
  disablePush,
  enablePush,
  keys,
  PushError,
  type PushSupport,
  refreshThisDevice,
} from '../../lib/push'
import { PrefGroup, PrefRow } from './ui'

/**
 * Por qué no se puede activar aquí, en palabras de usuario: la clave de cada caso en `integrations.push.blocked`.
 * `available` no sale: ahí va el interruptor.
 */
const BLOCKED = {
  'ios-install': 'iosInstall',
  denied: 'denied',
  unsupported: 'unsupported',
  unconfigured: 'unconfigured',
} as const satisfies Record<Exclude<PushSupport, 'available'>, string>

function useDevices() {
  const m = useMuninn()
  return useQuery({ queryKey: keys.devices, queryFn: () => m.push.devices() })
}

/** El `endpoint` de la suscripción de este navegador (o `null`): lo que distingue «este dispositivo» en la lista. */
function useBrowserEndpoint() {
  return useQuery({
    queryKey: keys.browser,
    queryFn: async () => (await browserSubscription())?.endpoint ?? null,
  })
}

function ThisDevice({ devices }: { devices: PushDevice[] | undefined }) {
  const { t } = useTranslation('integrations')
  const m = useMuninn()
  const qc = useQueryClient()
  // El permiso puede cambiar fuera (ajustes del navegador): se relee al montar y tras cada intento.
  const [support, setSupport] = useState<PushSupport>(currentSupport)
  const [busy, setBusy] = useState(false)
  const endpoint = useBrowserEndpoint().data
  const on = Boolean(endpoint && devices?.some((d) => d.endpoint === endpoint))

  const settle = () => {
    setSupport(currentSupport())
    void qc.invalidateQueries({ queryKey: keys.devices })
    void qc.invalidateQueries({ queryKey: keys.browser })
  }

  const toggle = async (next: boolean) => {
    setBusy(true)
    try {
      if (next) {
        const device = await enablePush(m)
        notify.success(t('push.enabled'), {
          icon: 'bell',
          description: device.label ?? undefined,
        })
      } else {
        await disablePush(m)
        notify.info(t('push.disabled'))
      }
    } catch (err) {
      if (err instanceof PushError && err.code === 'dismissed') notify.info(err.message)
      else fail(next ? t('push.enableFailed') : t('push.disableFailed'), err)
    }
    setBusy(false)
    settle()
  }

  const test = async () => {
    setBusy(true)
    try {
      const res = await m.push.test()
      // Un dispositivo que ya no existía se ha borrado: la lista cambia.
      if (res.removed) void qc.invalidateQueries({ queryKey: keys.devices })
      if (res.sent) {
        notify.success(t('push.testSent'), {
          icon: 'send',
          description: t('push.sentTo', { count: res.sent }),
        })
      } else
        notify.error(t('push.testNotDelivered'), {
          description: t('push.testNotDeliveredHint'),
        })
    } catch (err) {
      fail(t('push.testFailed'), err)
    }
    setBusy(false)
  }

  if (support !== 'available') {
    const blocked = BLOCKED[support]
    return (
      <PrefRow
        id="avisos"
        icon={support === 'ios-install' ? 'download' : 'warning'}
        tile="bg-project-amber/15 text-project-amber"
        title={t(`push.blocked.${blocked}.title`)}
        description={t(`push.blocked.${blocked}.text`)}
      />
    )
  }

  return (
    <>
      <PrefRow
        id="avisos"
        icon="bell"
        tile={on ? 'bg-accent-soft text-accent' : undefined}
        title={t('push.thisDeviceRow')}
        description={on ? t('push.onHint') : t('push.offHint')}
        htmlFor="ajuste-avisos-switch"
      >
        <Switch
          id="ajuste-avisos-switch"
          checked={on}
          disabled={busy || devices === undefined}
          onCheckedChange={(next) => void toggle(next)}
        />
      </PrefRow>
      {on && m.push.canTest() ? (
        <PrefRow id="probar" icon="send" title={t('push.test')} description={t('push.testHint')}>
          <Button size="sm" onClick={() => void test()} disabled={busy}>
            {t('push.sendTest')}
          </Button>
        </PrefRow>
      ) : null}
    </>
  )
}

function DeviceRow({ device, current }: { device: PushDevice; current: boolean }) {
  const { t } = useTranslation('integrations')
  const m = useMuninn()
  const qc = useQueryClient()
  const remove = async () => {
    const prev = qc.getQueryData<PushDevice[]>(keys.devices)
    qc.setQueryData(
      keys.devices,
      prev?.filter((d) => d.id !== device.id),
    )
    try {
      await m.push.unsubscribe(device.id)
      notifyUndo(t('push.removed', { name: device.label ?? t('push.device') }), {
        icon: 'trash',
        undo: () =>
          m.push
            .restore(device)
            .finally(() => void qc.invalidateQueries({ queryKey: keys.devices })),
        undone: t('push.restored'),
        failTitle: t('push.restoreFailed'),
      })
    } catch (err) {
      if (prev) qc.setQueryData(keys.devices, prev)
      fail(t('push.removeFailed'), err)
    }
    void qc.invalidateQueries({ queryKey: keys.devices })
  }
  return (
    <PrefRow
      icon="bell"
      tile={current ? 'bg-accent-soft text-accent' : undefined}
      title={
        <>
          {device.label ?? t('push.device')}
          {current ? (
            <span className="rounded-xs bg-accent-soft px-1.5 py-px text-2xs font-semibold text-accent">
              {t('push.thisOne')}
            </span>
          ) : null}
        </>
      }
      description={t('push.deviceDetails', {
        since: timeAgo(device.createdAt),
        seen: timeAgo(device.lastSeenAt),
      })}
    >
      <IconButton
        aria-label={
          device.label ? t('push.removeNamed', { name: device.label }) : t('push.removeDevice')
        }
        title={t('push.remove')}
        size="sm"
        icon={<icons.trash size={14} aria-hidden="true" />}
        onClick={() => void remove()}
      />
    </PrefRow>
  )
}

/** Ajustes › Notificaciones (ADR-0040): avisos push en este dispositivo, qué avisa y los dispositivos suscritos. */
export function Notificaciones() {
  const { t } = useTranslation('integrations')
  const auth = useAuth()
  const m = useMuninn()
  const qc = useQueryClient()
  const devices = useDevices()
  const endpoint = useBrowserEndpoint().data

  // Al entrar, si este dispositivo sigue en la lista, se refrescan sus claves y su «visto». Una vez por visita: tras
  // refrescar, la lista vuelve a llegar y no debe repetirse.
  const refreshed = useRef(false)
  useEffect(() => {
    if (!devices.data || refreshed.current) return
    refreshed.current = true
    void refreshThisDevice(m, devices.data)
      .then((changed) => {
        if (changed) void qc.invalidateQueries({ queryKey: keys.devices })
      })
      .catch(() => undefined)
  }, [devices.data, m, qc])

  if (auth.kind === 'demo') {
    return (
      <EmptyState
        icon="bell"
        title={t('push.demoTitle')}
        actions={
          <Button asChild variant="primary">
            <Link to="/login">{t('push.signIn')}</Link>
          </Button>
        }
      >
        {t('push.demoText')}
      </EmptyState>
    )
  }

  return (
    <>
      <PrefGroup title={t('push.thisDevice')} icon="bell">
        <ThisDevice devices={devices.data} />
      </PrefGroup>
      <PrefGroup title={t('push.whatTitle')} icon="info">
        <PrefRow
          id="avisos-cobros"
          icon="recurring"
          tile="bg-project-green/15 text-project-green"
          title={t('push.beforeCharge')}
          description={t('push.beforeChargeHint')}
        >
          <Button asChild size="sm" variant="ghost">
            <Link to="/finance" search={{ view: 'subscriptions' }}>
              {t('push.subscriptions')}
            </Link>
          </Button>
        </PrefRow>
        <PrefRow icon="agent" title={t('push.agentDone')} description={t('push.agentDoneHint')}>
          <span className="text-sm text-fg-faint">{t('push.soon')}</span>
        </PrefRow>
      </PrefGroup>
      <PrefGroup
        title={t('push.devicesTitle')}
        icon="sync"
        description={t('push.devicesDescription')}
      >
        <div id="ajuste-avisos-dispositivos">
          {devices.isPending ? (
            <p className="px-4 py-3.5 text-sm text-fg-subtle md:px-[18px]">{t('loading')}</p>
          ) : devices.isError ? (
            <p className="px-4 py-3.5 text-sm text-danger md:px-[18px]">
              {t('push.devicesLoadError')}
            </p>
          ) : devices.data.length === 0 ? (
            <p className="px-4 py-3.5 text-sm text-fg-subtle md:px-[18px]">{t('push.noDevices')}</p>
          ) : (
            devices.data.map((d) => (
              <DeviceRow key={d.id} device={d} current={d.endpoint === endpoint} />
            ))
          )}
        </div>
      </PrefGroup>
    </>
  )
}
