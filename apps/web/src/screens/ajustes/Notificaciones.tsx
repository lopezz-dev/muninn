import type { PushDevice } from '@muninn/core'
import { Button, IconButton, icons, notify, Switch } from '@muninn/ui'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
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

/** Por qué no se puede activar aquí, en palabras de usuario. `available` no sale: ahí va el interruptor. */
const BLOCKED: Record<Exclude<PushSupport, 'available'>, { title: string; text: string }> = {
  'ios-install': {
    title: 'Añade Muninn a tu pantalla de inicio',
    text: 'En iPhone y iPad los avisos solo funcionan con la app instalada (iOS 16.4 o posterior). En Safari, toca Compartir › «Añadir a pantalla de inicio», abre Muninn desde el icono y vuelve aquí.',
  },
  denied: {
    title: 'Avisos bloqueados',
    text: 'Bloqueaste los avisos de Muninn. Para volver a recibirlos, permítelos en los ajustes del navegador (en el iPhone: Ajustes › Notificaciones › Muninn) y vuelve aquí.',
  },
  unsupported: {
    title: 'Este navegador no admite avisos',
    text: 'Abre Muninn en el móvil o en Chrome, Edge, Firefox o Safari del ordenador. En la app de escritorio aún no hay avisos.',
  },
  unconfigured: {
    title: 'Avisos sin configurar',
    text: 'Esta instalación de Muninn aún no tiene la clave de los avisos. Cuando esté, podrás activarlos aquí.',
  },
}

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
        notify.success('Avisos activados en este dispositivo', {
          icon: 'bell',
          description: device.label ?? undefined,
        })
      } else {
        await disablePush(m)
        notify.info('Avisos desactivados en este dispositivo')
      }
    } catch (err) {
      if (err instanceof PushError && err.code === 'dismissed') notify.info(err.message)
      else fail(next ? 'No se pudieron activar los avisos' : 'No se pudieron desactivar', err)
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
        notify.success('Aviso de prueba enviado', {
          icon: 'send',
          description: res.sent === 1 ? 'a 1 dispositivo' : `a ${res.sent} dispositivos`,
        })
      } else
        notify.error('No llegó a ningún dispositivo', {
          description: 'Vuelve a activar los avisos aquí',
        })
    } catch (err) {
      fail('No se pudo enviar el aviso de prueba', err)
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
        title={blocked.title}
        description={blocked.text}
      />
    )
  }

  return (
    <>
      <PrefRow
        id="avisos"
        icon="bell"
        tile={on ? 'bg-accent-soft text-accent' : undefined}
        title="Avisos en este dispositivo"
        description={
          on
            ? 'Activados. Te llegan aunque Muninn esté cerrada.'
            : 'Te pedirá permiso. Puedes quitarlos cuando quieras.'
        }
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
        <PrefRow
          id="probar"
          icon="send"
          title="Probar"
          description="Manda un aviso a todos tus dispositivos para ver que llega."
        >
          <Button size="sm" onClick={() => void test()} disabled={busy}>
            Enviar prueba
          </Button>
        </PrefRow>
      ) : null}
    </>
  )
}

function DeviceRow({ device, current }: { device: PushDevice; current: boolean }) {
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
      notifyUndo(`«${device.label ?? 'Dispositivo'}» ya no recibe avisos`, {
        icon: 'trash',
        undo: () =>
          m.push
            .restore(device)
            .finally(() => void qc.invalidateQueries({ queryKey: keys.devices })),
        undone: 'Dispositivo recuperado',
        failTitle: 'No se pudo recuperar el dispositivo',
      })
    } catch (err) {
      if (prev) qc.setQueryData(keys.devices, prev)
      fail('No se pudo quitar el dispositivo', err)
    }
    void qc.invalidateQueries({ queryKey: keys.devices })
  }
  return (
    <PrefRow
      icon="bell"
      tile={current ? 'bg-accent-soft text-accent' : undefined}
      title={
        <>
          {device.label ?? 'Dispositivo'}
          {current ? (
            <span className="rounded-xs bg-accent-soft px-1.5 py-px text-2xs font-semibold text-accent">
              Este
            </span>
          ) : null}
        </>
      }
      description={`Activado ${timeAgo(device.createdAt)} · visto ${timeAgo(device.lastSeenAt)}`}
    >
      <IconButton
        aria-label={`Quitar ${device.label ?? 'el dispositivo'}`}
        title="Quitar"
        size="sm"
        icon={<icons.trash size={14} aria-hidden="true" />}
        onClick={() => void remove()}
      />
    </PrefRow>
  )
}

/** Ajustes › Notificaciones (ADR-0040): avisos push en este dispositivo, qué avisa y los dispositivos suscritos. */
export function Notificaciones() {
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
        title="Los avisos necesitan una cuenta"
        actions={
          <Button asChild variant="primary">
            <Link to="/login">Iniciar sesión</Link>
          </Button>
        }
      >
        En el modo demo no hay servidor que te avise. Con una cuenta, Muninn te avisa en el móvil
        antes de cada cobro aunque la app esté cerrada.
      </EmptyState>
    )
  }

  return (
    <>
      <PrefGroup title="Este dispositivo" icon="bell">
        <ThisDevice devices={devices.data} />
      </PrefGroup>
      <PrefGroup title="Qué te avisa" icon="info">
        <PrefRow
          id="avisos-cobros"
          icon="recurring"
          tile="bg-project-green/15 text-project-green"
          title="Antes de cada cobro"
          description="Cada mañana, de las suscripciones que se cobran dentro de sus días de aviso. Un aviso por cobro."
        >
          <Button asChild size="sm" variant="ghost">
            <Link to="/finanzas" search={{ vista: 'suscripciones' }}>
              Suscripciones
            </Link>
          </Button>
        </PrefRow>
        <PrefRow icon="agent" title="Cuando un agente termine" description="Llegará más adelante.">
          <span className="text-sm text-fg-faint">Próximamente</span>
        </PrefRow>
      </PrefGroup>
      <PrefGroup
        title="Dispositivos"
        icon="sync"
        description="Los que reciben tus avisos. Quita los que ya no uses."
      >
        <div id="ajuste-avisos-dispositivos">
          {devices.isPending ? (
            <p className="px-4 py-3.5 text-sm text-fg-subtle md:px-[18px]">Cargando…</p>
          ) : devices.isError ? (
            <p className="px-4 py-3.5 text-sm text-danger md:px-[18px]">
              No se pudo cargar la lista de dispositivos.
            </p>
          ) : devices.data.length === 0 ? (
            <p className="px-4 py-3.5 text-sm text-fg-subtle md:px-[18px]">
              Aún no hay ninguno. Activa los avisos en el móvil desde esta misma pantalla.
            </p>
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
