import { Button } from '@muninn/ui'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { timeAgo } from '../../lib/dates'
import { useMuninn } from '../../lib/muninn'
import { keys } from '../../lib/queries'
import { ActivarSegundoFactor, DesactivarSegundoFactor } from './SegundoFactorDialogos'
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
  const [dialog, setDialog] = useState<'enroll' | 'disable' | null>(null)
  const active = factors.data?.find((f) => f.status === 'verified')
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
      {dialog === 'enroll' ? <ActivarSegundoFactor onClose={close} /> : null}
      {dialog === 'disable' ? <DesactivarSegundoFactor onClose={close} /> : null}
    </PrefGroup>
  )
}
