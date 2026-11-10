import {
  Avatar,
  Icon,
  icons,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
} from '@muninn/ui'
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../lib/muninn'
import { useEndSession } from '../lib/session'
import { SECTIONS } from './nav'
import { UserButton } from './UserButton'

const PROVIDER = { github: 'account.viaGithub', email: 'account.viaEmail' } as const

/**
 * Menú de tu cuenta al pie de la barra lateral (ADR-0072): hacia arriba con la barra ancha y a la derecha con el raíl.
 * Flechas para moverte y Esc para cerrar (Radix). ⌘⇧U / Ctrl ⇧ U lo abre desde cualquier sitio. Diferido: así el menú
 * de Radix no viaja en el arranque.
 */
export function UserMenu({ rail }: { rail: boolean }) {
  const auth = useAuth()
  const navigate = useNavigate()
  const endSession = useEndSession()
  const [open, setOpen] = useState(false)
  const { t } = useTranslation()
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || !e.shiftKey || e.altKey || e.key.toLowerCase() !== 'u')
        return
      // Solo si la barra lateral se ve (en el teléfono, la cuenta está en el avatar de abajo).
      if (!triggerRef.current?.offsetParent) return
      e.preventDefault()
      setOpen((o) => !o)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const go = (seccion: string) => void navigate({ to: '/settings/$seccion', params: { seccion } })

  return (
    <Menu open={open} onOpenChange={setOpen}>
      <MenuTrigger asChild>
        <UserButton ref={triggerRef} rail={rail} aria-haspopup="menu" />
      </MenuTrigger>
      <MenuContent
        side={rail ? 'right' : 'top'}
        align={rail ? 'end' : 'start'}
        className="w-[264px]"
      >
        <div className="flex items-center gap-2.5 border-b border-border-subtle px-2 pt-1.5 pb-2.5 mb-1">
          {auth.kind === 'user' ? (
            <Avatar name={auth.account.name} src={auth.account.avatarUrl} />
          ) : (
            <span className="grid size-7 place-items-center rounded-full bg-border-strong text-fg-subtle">
              <Icon name="user" />
            </span>
          )}
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-sm font-semibold">
              {auth.kind === 'user' ? auth.account.name : t('account.demo')}
            </span>
            <span className="truncate text-xs text-fg-subtle">
              {auth.kind === 'user'
                ? auth.account.provider in PROVIDER
                  ? t(PROVIDER[auth.account.provider as keyof typeof PROVIDER])
                  : auth.account.email
                : t('account.demoNotSaved')}
            </span>
          </span>
        </div>
        <MenuItem icon={<icons.user />} onSelect={() => go('account')}>
          {t('account.account')}
        </MenuItem>
        <MenuItem icon={<icons.settings />} onSelect={() => void navigate({ to: '/settings' })}>
          {t('nav.settings')}
        </MenuItem>
        <MenuItem icon={<icons.keyboard />} onSelect={() => go('shortcuts')}>
          {t('account.shortcuts')}
        </MenuItem>
        <MenuItem icon={<icons.docs />} onSelect={() => void navigate({ to: SECTIONS.docs.to })}>
          {t('nav.docsLong')}
        </MenuItem>
        <MenuSeparator />
        <MenuItem icon={<icons.info />} onSelect={() => go('about')}>
          <span className="flex items-center">
            {t('account.about')}
            <span className="ml-auto font-mono text-xs text-fg-faint">v{__APP_VERSION__}</span>
          </span>
        </MenuItem>
        <MenuSeparator />
        <MenuItem danger icon={<icons.signOut />} onSelect={() => void endSession(auth.kind)}>
          {auth.kind === 'user' ? t('account.signOut') : t('account.leaveDemo')}
        </MenuItem>
      </MenuContent>
    </Menu>
  )
}
