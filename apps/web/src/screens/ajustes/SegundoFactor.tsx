import { Button } from '@muninn/ui'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { timeAgo } from '../../lib/dates'
import { useMuninn } from '../../lib/muninn'
import { keys } from '../../lib/queries'
import {
  ActivarSegundoFactor,
  DesactivarSegundoFactor,
  GenerarCodigos,
} from './SegundoFactorDialogos'
import { PrefGroup, PrefRow } from './ui'

/**
 * Segundo factor con una app de códigos (TOTP), opcional (ADR-0061). La fila dice si está activado; activarlo y
 * desactivarlo se hace en su diálogo (`SegundoFactorDialogos.tsx`).
 */

/** Ajustes › Cuenta › Segundo factor. */
export function SegundoFactor() {
  const m = useMuninn()
  const factors = useQuery({
    queryKey: keys.accountMfa,
    queryFn: () => m.account.mfa.factors(),
    enabled: m.account.available(),
  })
  const [dialog, setDialog] = useState<'enroll' | 'disable' | 'codes' | null>(null)
  const active = factors.data?.find((f) => f.status === 'verified')
  // Códigos de recuperación (ADR-0075): solo tienen sentido con el segundo factor activado.
  const recovery = useQuery({
    queryKey: keys.accountRecoveryCodes,
    queryFn: () => m.account.mfa.recoveryCodes.status(),
    enabled: m.account.available() && Boolean(active),
  })
  const close = () => setDialog(null)

  if (!m.account.available()) return null
  return (
    <PrefGroup
      title="Segundo factor"
      icon="shield"
      description="Además del código del correo o de GitHub, un código de una app de tu móvil. Opcional."
    >
      <PrefRow
        id="segundo-factor"
        icon="key"
        tile={active ? 'bg-success/15 text-success' : undefined}
        title="App de códigos"
        description={
          factors.isPending
            ? 'Cargando…'
            : factors.isError
              ? 'No se pudo comprobar si está activado.'
              : active
                ? `Activado ${timeAgo(active.createdAt)}. Al entrar, te pedimos un código de la app.`
                : 'Desactivado. Para entrar basta con el código del correo o con GitHub.'
        }
      >
        {factors.isSuccess ? (
          active ? (
            <Button size="sm" onClick={() => setDialog('disable')}>
              Desactivar
            </Button>
          ) : (
            <Button size="sm" variant="primary" onClick={() => setDialog('enroll')}>
              Activar
            </Button>
          )
        ) : null}
      </PrefRow>
      {active ? (
        <PrefRow
          id="codigos-recuperacion"
          icon="key"
          tile={
            recovery.data && recovery.data.remaining <= 2 ? 'bg-danger-soft text-danger' : undefined
          }
          title="Códigos de recuperación"
          description={
            recovery.isPending
              ? 'Cargando…'
              : recovery.isError
                ? 'No están disponibles ahora mismo.'
                : !recovery.data
                  ? 'Sin generar. Te sirven para entrar si pierdes el móvil.'
                  : recovery.data.remaining === 0
                    ? 'Los has usado todos. Genera otros por si pierdes el móvil.'
                    : `Te quedan ${recovery.data.remaining} de ${recovery.data.total}. Cada uno vale una vez.`
          }
        >
          {recovery.isSuccess ? (
            <Button
              size="sm"
              variant={!recovery.data || recovery.data.remaining <= 2 ? 'primary' : undefined}
              onClick={() => setDialog('codes')}
            >
              {recovery.data ? 'Generar nuevos' : 'Generar'}
            </Button>
          ) : null}
        </PrefRow>
      ) : null}
      {dialog === 'enroll' ? <ActivarSegundoFactor onClose={close} /> : null}
      {dialog === 'codes' ? (
        <GenerarCodigos replacing={Boolean(recovery.data)} onClose={close} />
      ) : null}
      {dialog === 'disable' ? <DesactivarSegundoFactor onClose={close} /> : null}
    </PrefGroup>
  )
}
