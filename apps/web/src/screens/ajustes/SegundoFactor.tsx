import { Button } from '@muninn/ui'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation('security')
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
    <PrefGroup title={t('mfa.title')} icon="shield" description={t('mfa.description')}>
      <PrefRow
        id="segundo-factor"
        icon="key"
        tile={active ? 'bg-success/15 text-success' : undefined}
        title={t('mfa.app')}
        description={
          factors.isPending
            ? t('loading')
            : factors.isError
              ? t('mfa.checkFailed')
              : active
                ? t('mfa.on', { time: timeAgo(active.createdAt) })
                : t('mfa.off')
        }
      >
        {factors.isSuccess ? (
          active ? (
            <Button size="sm" onClick={() => setDialog('disable')}>
              {t('mfa.turnOff')}
            </Button>
          ) : (
            <Button size="sm" variant="primary" onClick={() => setDialog('enroll')}>
              {t('mfa.turnOn')}
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
          title={t('mfa.codesTitle')}
          description={
            recovery.isPending
              ? t('loading')
              : recovery.isError
                ? t('mfa.codesUnavailable')
                : !recovery.data
                  ? t('mfa.codesNone')
                  : recovery.data.remaining === 0
                    ? t('mfa.codesUsedUp')
                    : t('mfa.codesLeft', {
                        remaining: recovery.data.remaining,
                        total: recovery.data.total,
                      })
          }
        >
          {recovery.isSuccess ? (
            <Button
              size="sm"
              variant={!recovery.data || recovery.data.remaining <= 2 ? 'primary' : undefined}
              onClick={() => setDialog('codes')}
            >
              {recovery.data ? t('mfa.generateNew') : t('mfa.generate')}
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
