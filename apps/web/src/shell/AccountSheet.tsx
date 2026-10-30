import { Avatar, Button, cn, Dialog, Icon, icons, notify, SheetContent } from '@muninn/ui'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { AppIcon } from '../components/AppIcon'
import { accountSheet, useAccountSheet } from '../lib/account-sheet'
import { isTauri } from '../lib/auth'
import { useDockTabs } from '../lib/dock'
import { useEnabledModules } from '../lib/modules'
import { useAuth } from '../lib/muninn'
import { useEndSession } from '../lib/session'
import { bySection, useChangedPrefs } from '../lib/settings-changes'
import { useSectionHints } from '../screens/ajustes/Ajustes'
import { RESET_LABEL, SectionContent, useReset } from '../screens/ajustes/Seccion'
import {
  ABOUT_SECTION,
  type SettingsSection,
  sectionsByGroup,
  settingsSection,
} from '../screens/ajustes/sections'
import { ChangedDot, MicroTitle } from '../screens/ajustes/ui'
import { SECTIONS, type SectionId, sectionEnabled } from './nav'
import { useShell } from './shell-context'

/** «Ir a»: las secciones que no están en tu barra, con el color de su módulo. */
const GO_TO: { id: SectionId; tile: string }[] = [
  { id: 'home', tile: 'bg-accent-soft text-accent' },
  { id: 'projects', tile: 'bg-project-blue/15 text-project-blue' },
  { id: 'notes', tile: 'bg-project-teal/15 text-project-teal' },
  { id: 'finance', tile: 'bg-project-green/15 text-project-green' },
  { id: 'news', tile: 'bg-project-pink/15 text-project-pink' },
  { id: 'github', tile: 'bg-project-violet/15 text-project-violet' },
  { id: 'docs', tile: 'bg-project-blue/15 text-project-blue' },
]

const tileClass =
  'flex min-h-[78px] flex-col items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-1 py-2.5 text-center text-xs text-fg-muted transition-colors hover:border-border-strong hover:text-fg'

const rowClass =
  'flex min-h-[50px] w-full cursor-pointer items-center gap-3 border-t border-border-subtle px-3.5 text-left text-md text-fg first:border-t-0 hover:bg-surface-hover'

function Tile({ icon, label, tile }: { icon: SectionId | 'search'; label: string; tile: string }) {
  return (
    <>
      <span className={cn('grid size-[34px] place-items-center rounded-md', tile)}>
        <Icon name={icon === 'search' ? 'search' : SECTIONS[icon].icon} size={19} />
      </span>
      <span className="max-w-full truncate">{label}</span>
    </>
  )
}

function SectionRow({
  section,
  hint,
  changed,
}: {
  section: SettingsSection
  hint?: string
  changed?: boolean
}) {
  return (
    <button type="button" className={rowClass} onClick={() => accountSheet.push(section.id)}>
      <span className={cn('grid size-[30px] shrink-0 place-items-center rounded-md', section.tile)}>
        <AppIcon name={section.icon} size={17} />
      </span>
      <span className={cn('min-w-0 flex-1 truncate', section.soon && 'text-fg-muted')}>
        {section.label}
      </span>
      {hint ? <span className="text-sm text-fg-faint">{hint}</span> : null}
      {changed ? <ChangedDot /> : null}
      <icons.chevronRight aria-hidden="true" className="text-fg-faint" />
    </button>
  )
}

/** Raíz de la hoja: tú, «Ir a», Ajustes por grupos, Documentación y «Acerca de». */
function Root() {
  const auth = useAuth()
  const shell = useShell()
  const modules = useEnabledModules()
  const tabs = useDockTabs()
  const hints = useSectionHints()
  const changed = bySection(useChangedPrefs())
  const goTo = GO_TO.filter(
    (s) => !(tabs as readonly string[]).includes(s.id) && sectionEnabled(s.id, modules),
  )

  return (
    <div className="flex flex-col gap-5">
      <button
        type="button"
        onClick={() => accountSheet.push('cuenta')}
        className="flex w-full cursor-pointer items-center gap-3 rounded-lg border border-border bg-surface px-3.5 py-3 text-left transition-colors hover:border-border-strong"
      >
        {auth.kind === 'user' ? (
          <Avatar name={auth.account.name} src={auth.account.avatarUrl} size="lg" />
        ) : (
          <span className="grid size-12 shrink-0 place-items-center rounded-md bg-border-strong text-fg-subtle">
            <Icon name="user" size={22} />
          </span>
        )}
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-md font-semibold">
            {auth.kind === 'user' ? auth.account.name : 'Modo demo'}
          </span>
          <span className="flex items-center gap-1.5 text-sm text-fg-subtle">
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
        <icons.chevronRight aria-hidden="true" className="text-fg-faint" />
      </button>

      <section aria-labelledby="hoja-ir-a" className="flex flex-col gap-2">
        <MicroTitle className="px-1">
          <span id="hoja-ir-a">Ir a</span>
        </MicroTitle>
        <div className="grid grid-cols-4 gap-2">
          {goTo.map((s) => (
            <Link
              key={s.id}
              to={SECTIONS[s.id].to}
              onClick={accountSheet.close}
              className={tileClass}
            >
              <Tile
                icon={s.id}
                label={s.id === 'docs' ? 'Docs' : SECTIONS[s.id].label}
                tile={s.tile}
              />
            </Link>
          ))}
          {tabs.includes('search') ? null : (
            <button
              type="button"
              className={cn(tileClass, 'cursor-pointer')}
              onClick={() => {
                accountSheet.close()
                shell.openPalette()
              }}
            >
              <Tile icon="search" label="Buscar" tile="bg-surface-raised text-fg-muted" />
            </button>
          )}
          {isTauri ? (
            <Link to="/asistente" onClick={accountSheet.close} className={tileClass}>
              <span className="grid size-[34px] place-items-center rounded-md bg-project-amber/15 text-project-amber">
                <Icon name="assistant" size={19} />
              </span>
              Asistente
            </Link>
          ) : (
            // En el móvil aún no contesta (no hay modelo): atenuado, y al tocarlo se explica.
            <button
              type="button"
              aria-disabled="true"
              className={cn(tileClass, 'cursor-pointer opacity-50')}
              onClick={() =>
                notify.info('El Asistente funciona en el ordenador', {
                  description: 'Usa el modelo de tu ordenador. En el móvil llegará más adelante',
                })
              }
            >
              <span className="grid size-[34px] place-items-center rounded-md bg-project-amber/15 text-project-amber">
                <Icon name="assistant" size={19} />
              </span>
              <span className="flex flex-col leading-tight">
                Asistente
                <span className="text-2xs text-fg-faint">En el ordenador</span>
              </span>
            </button>
          )}
        </div>
      </section>

      {sectionsByGroup().map((g) => (
        <section key={g.id} className="flex flex-col gap-2">
          <MicroTitle className="px-1">{g.label}</MicroTitle>
          <div className="glass overflow-hidden rounded-lg border border-border">
            {g.sections.map((s) => (
              <SectionRow
                key={s.id}
                section={s}
                hint={hints[s.id]}
                changed={Boolean(changed[s.id]?.length)}
              />
            ))}
          </div>
        </section>
      ))}

      <div className="glass overflow-hidden rounded-lg border border-border">
        <Link to="/documentacion" onClick={accountSheet.close} className={rowClass}>
          <span className="grid size-[30px] shrink-0 place-items-center rounded-md bg-project-blue/15 text-project-blue">
            <Icon name="docs" size={17} />
          </span>
          <span className="min-w-0 flex-1 truncate">Documentación</span>
          <icons.chevronRight aria-hidden="true" className="text-fg-faint" />
        </Link>
        <SectionRow section={ABOUT_SECTION} hint={hints.acerca} />
      </div>
    </div>
  )
}

/** Una sección de Ajustes dentro de la hoja: su cabecera compacta y el mismo contenido que en escritorio. */
function SectionView({ section }: { section: SettingsSection }) {
  const auth = useAuth()
  const endSession = useEndSession()
  const [busy, setBusy] = useState(false)
  const { changed, reset } = useReset(section.id)
  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-start gap-3">
        <span className={cn('grid size-10 shrink-0 place-items-center rounded-lg', section.tile)}>
          <AppIcon name={section.icon} size={20} />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="text-xl font-semibold tracking-tight">{section.label}</h2>
          <p className="text-sm text-fg-subtle">{section.subtitle}</p>
        </div>
      </header>
      {changed.length > 0 ? (
        <Button
          size="sm"
          className="self-start"
          onClick={() =>
            reset(changed, RESET_LABEL[section.id] ?? `${section.label}: valores de fábrica`)
          }
        >
          <AppIcon name="reset" size={13} />
          Restablecer sección
        </Button>
      ) : null}
      <SectionContent section={section} />
      {section.id === 'cuenta' && auth.kind === 'user' ? (
        <Button
          variant="danger"
          size="lg"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            accountSheet.close()
            await endSession('user')
            setBusy(false)
          }}
        >
          <Icon name="signOut" />
          {busy ? 'Cerrando…' : 'Cerrar sesión'}
        </Button>
      ) : null}
    </div>
  )
}

const viewTitle = (view: string) =>
  view === 'root' ? 'Tu cuenta' : (settingsSection(view)?.label ?? 'Tu cuenta')

/**
 * Hoja «Tu cuenta» del teléfono (ADR-0072): se abre con tu avatar, abajo a la derecha, o con un enlace a
 * `/ajustes/<sección>`. Dentro se navega con «‹» y, al cerrarla (fuera, Esc o arrastrando el asa), sigues en la
 * pantalla en la que estabas. Diseño: lienzo «Dock y cuenta».
 */
export function AccountSheet() {
  const { open, stack } = useAccountSheet()
  const view = stack.at(-1) ?? 'root'
  const parent = stack.at(-2)
  const section = view === 'root' ? null : settingsSection(view)

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? accountSheet.open() : accountSheet.close())}>
      <SheetContent
        side="bottom"
        title={viewTitle(view)}
        hideTitle={Boolean(section)}
        onDragClose={accountSheet.close}
        className="h-[88dvh] md:hidden"
        leading={
          parent ? (
            <button
              type="button"
              onClick={accountSheet.pop}
              className="flex h-9 cursor-pointer items-center gap-0.5 rounded-md pr-2 pl-1 text-base font-medium whitespace-nowrap text-accent hover:bg-surface-hover"
            >
              <icons.chevronLeft size={18} aria-hidden="true" />
              {viewTitle(parent)}
            </button>
          ) : null
        }
      >
        {/* La clave hace que cada vista entre con su animación; al montarse, el scroll vuelve arriba. */}
        <div
          key={stack.join('/')}
          ref={(el) => el?.parentElement?.scrollTo(0, 0)}
          className="animate-fade-in pb-[env(safe-area-inset-bottom)]"
        >
          {section ? <SectionView section={section} /> : <Root />}
        </div>
      </SheetContent>
    </Dialog>
  )
}
