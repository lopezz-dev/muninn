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
import { useAuth } from '../lib/muninn'
import { useEndSession } from '../lib/session'
import { UserButton } from './UserButton'

const PROVIDER: Record<string, string> = {
  github: 'Entras con GitHub',
  email: 'Entras con un código',
}

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

  const go = (seccion: string) => void navigate({ to: '/ajustes/$seccion', params: { seccion } })

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
            <span className="grid size-7 place-items-center rounded-md bg-border-strong text-fg-subtle">
              <Icon name="user" />
            </span>
          )}
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-sm font-semibold">
              {auth.kind === 'user' ? auth.account.name : 'Modo demo'}
            </span>
            <span className="truncate text-xs text-fg-subtle">
              {auth.kind === 'user'
                ? (PROVIDER[auth.account.provider] ?? auth.account.email)
                : 'Tus datos no se guardan'}
            </span>
          </span>
        </div>
        <MenuItem icon={<icons.user />} onSelect={() => go('cuenta')}>
          Cuenta
        </MenuItem>
        <MenuItem icon={<icons.settings />} onSelect={() => void navigate({ to: '/ajustes' })}>
          Ajustes
        </MenuItem>
        <MenuItem icon={<icons.keyboard />} onSelect={() => go('atajos')}>
          Atajos de teclado
        </MenuItem>
        <MenuItem icon={<icons.docs />} onSelect={() => void navigate({ to: '/documentacion' })}>
          Documentación
        </MenuItem>
        <MenuSeparator />
        <MenuItem icon={<icons.info />} onSelect={() => go('acerca')}>
          <span className="flex items-center">
            Acerca de Muninn
            <span className="ml-auto font-mono text-xs text-fg-faint">v{__APP_VERSION__}</span>
          </span>
        </MenuItem>
        <MenuSeparator />
        <MenuItem danger icon={<icons.signOut />} onSelect={() => void endSession(auth.kind)}>
          {auth.kind === 'user' ? 'Cerrar sesión' : 'Salir del modo demo'}
        </MenuItem>
      </MenuContent>
    </Menu>
  )
}
