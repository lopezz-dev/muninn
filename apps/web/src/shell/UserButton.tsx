import { Avatar, cn, Icon, icons } from '@muninn/ui'
import type { ComponentProps } from 'react'
import { useAuth } from '../lib/muninn'
import { USER_MENU_SHORTCUT } from './shell-context'

/**
 * Tu usuario al pie de la barra lateral (ADR-0072): una sola fila que abre el menú de tu cuenta. Va en el shell; el
 * menú (`UserMenu`) llega en diferido y lo envuelve como disparador.
 */
export function UserButton({
  rail,
  className,
  ...props
}: ComponentProps<'button'> & { rail: boolean }) {
  const auth = useAuth()
  const name = auth.kind === 'user' ? auth.account.name : 'Modo demo'
  return (
    <button
      type="button"
      aria-label={`Tu cuenta: ${name}`}
      title={`Tu cuenta (${USER_MENU_SHORTCUT})`}
      aria-keyshortcuts={USER_MENU_SHORTCUT.startsWith('⌘') ? 'Meta+Shift+U' : 'Control+Shift+U'}
      className={cn(
        'flex w-full cursor-pointer items-center gap-2.5 rounded-md py-1.5 text-left transition-colors hover:bg-surface-hover data-[state=open]:bg-surface-hover',
        rail ? 'justify-center' : 'px-2',
        className,
      )}
      {...props}
    >
      {auth.kind === 'user' ? (
        <Avatar name={auth.account.name} src={auth.account.avatarUrl} />
      ) : (
        <span
          aria-hidden="true"
          className="grid size-7 shrink-0 place-items-center rounded-md bg-border-strong text-fg-subtle"
        >
          <Icon name="user" />
        </span>
      )}
      {rail ? null : (
        <>
          <span className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="truncate text-sm font-medium">{name}</span>
            <span className="flex items-center gap-1.5 text-xs text-fg-faint">
              <span
                aria-hidden="true"
                className={cn(
                  'size-1.5 rounded-full',
                  auth.kind === 'user' ? 'bg-success' : 'bg-fg-faint',
                )}
              />
              {auth.kind === 'user' ? 'Guardado en tu cuenta' : 'Datos sin guardar'}
            </span>
          </span>
          <icons.chevronUpDown aria-hidden="true" className="shrink-0 text-fg-faint" />
        </>
      )}
    </button>
  )
}
