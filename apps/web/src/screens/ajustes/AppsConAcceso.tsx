import type { OAuthAppGrant } from '@muninn/core'
import { Button, notify } from '@muninn/ui'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { timeAgo } from '../../lib/dates'
import { useMuninn } from '../../lib/muninn'
import { fail } from '../../lib/mutations'
import { redirectHost, scopeLabels } from '../../lib/oauth-consent'
import { keys } from '../../lib/queries'
import { PrefGroup, PrefRow } from './ui'

/**
 * Apps a las que diste acceso a tu cuenta por OAuth (claude.ai y otros clientes del MCP remoto, ADR-0036 y ADR-0061).
 * Quitar el acceso no tiene «Deshacer»: el permiso solo se da desde la propia app, pasando por la pantalla de autorización.
 */

function AppRow({ grant }: { grant: OAuthAppGrant }) {
  const m = useMuninn()
  const qc = useQueryClient()
  const [busy, setBusy] = useState(false)
  const revoke = async () => {
    setBusy(true)
    try {
      await m.account.apps.revoke(grant.clientId)
      notify.success(`${grant.name} ya no tiene acceso`, {
        icon: 'user',
        description: 'Para volver a usarla con Muninn, conéctala otra vez desde esa app.',
      })
    } catch (err) {
      fail('No se pudo quitar el acceso', err)
    }
    setBusy(false)
    void qc.invalidateQueries({ queryKey: keys.accountApps })
  }
  const details = [
    `Desde ${timeAgo(grant.grantedAt)}`,
    grant.uri ? redirectHost(grant.uri) : null,
    ...scopeLabels(grant.scopes.join(' ')),
  ].filter(Boolean)
  return (
    <PrefRow icon="plug" title={grant.name} description={details.join(' · ')}>
      <Button size="sm" variant="danger" onClick={() => void revoke()} disabled={busy}>
        {busy ? 'Quitando…' : 'Quitar acceso'}
      </Button>
    </PrefRow>
  )
}

/** Ajustes › Cuenta › Apps con acceso. */
export function AppsConAcceso() {
  const m = useMuninn()
  const grants = useQuery({
    queryKey: keys.accountApps,
    queryFn: () => m.account.apps.list(),
    enabled: m.account.available(),
  })
  if (!m.account.available()) return null
  return (
    <PrefGroup
      title="Apps con acceso"
      icon="plug"
      description="Las que pueden usar tu cuenta por el MCP remoto, como claude.ai. Ven y cambian proyectos, tareas y notas; nunca borran."
    >
      <div id="ajuste-apps">
        {grants.isPending ? (
          <p className="px-4 py-3.5 text-sm text-fg-subtle md:px-[18px]">Cargando…</p>
        ) : grants.isError ? (
          <p className="px-4 py-3.5 text-sm text-danger md:px-[18px]">
            No se pudo cargar la lista de apps.
          </p>
        ) : grants.data.length === 0 ? (
          <p className="px-4 py-3.5 text-sm text-fg-subtle md:px-[18px]">
            Ninguna. Cuando conectes claude.ai u otra app a Muninn, saldrá aquí.
          </p>
        ) : (
          grants.data.map((g) => <AppRow key={g.clientId} grant={g} />)
        )}
      </div>
    </PrefGroup>
  )
}
