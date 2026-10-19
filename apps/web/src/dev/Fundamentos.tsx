import {
  ACCENTS,
  type AccentName,
  AmountField,
  type Appearance,
  Avatar,
  applyAppearance,
  Button,
  Card,
  CardHeader,
  Checkbox,
  Chip,
  ColorDot,
  colors,
  columnKinds,
  copyText,
  DEFAULT_APPEARANCE,
  Dialog,
  DialogClose,
  DialogContent,
  DialogTrigger,
  Icon,
  IconButton,
  type IconName,
  icons,
  Kbd,
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
  notify,
  ProgressBar,
  SegmentedControl,
  SheetContent,
  Switch,
  TextArea,
  TextField,
  Tooltip,
} from '@muninn/ui'
import { useEffect, useState } from 'react'
import { backendLabel } from '../lib/muninn'

const NAV: { icon: IconName; label: string }[] = [
  { icon: 'home', label: 'Inicio' },
  { icon: 'projects', label: 'Proyectos' },
  { icon: 'notes', label: 'Notas' },
  { icon: 'finance', label: 'Finanzas' },
  { icon: 'assistant', label: 'Asistente' },
  { icon: 'news', label: 'Noticias' },
  { icon: 'github', label: 'GitHub' },
]

const KIND_LABEL: Record<keyof typeof columnKinds, string> = {
  backlog: 'Backlog',
  todo: 'Pendiente',
  in_progress: 'En curso',
  review: 'Revisión',
  done: 'Hecho',
}

const ACTION_DEMOS: { icon: IconName; title: string; motion: string }[] = [
  { icon: 'link', title: 'Enlace copiado', motion: 'se eleva' },
  { icon: 'move', title: 'Tarea movida', motion: 'avanza' },
  { icon: 'archive', title: 'Tarea archivada', motion: 'cae a la caja' },
  { icon: 'trash', title: 'Tarea borrada', motion: 'tiembla' },
  { icon: 'plus', title: 'Proyecto creado', motion: 'gira' },
  { icon: 'sync', title: 'Sincronizado', motion: 'da una vuelta' },
  { icon: 'pin', title: 'Nota fijada', motion: 'se clava' },
  { icon: 'finance', title: 'Gasto guardado', motion: 'late' },
]

const sectionTitle = 'mb-4 text-xs font-semibold uppercase tracking-wider text-fg-subtle'

/** Página de desarrollo: tokens y componentes de @muninn/ui con el tema real. */
export function Fundamentos() {
  const [appearance, setAppearance] = useState<Appearance>(DEFAULT_APPEARANCE)
  const [view, setView] = useState<'board' | 'list' | 'calendar'>('board')
  const [kind, setKind] = useState<'expense' | 'income' | 'saving' | 'investment'>('expense')
  const [done, setDone] = useState(false)
  const [pushOn, setPushOn] = useState(true)
  const [amount, setAmount] = useState<number | null>(2490)
  const [column, setColumn] = useState<keyof typeof columnKinds>('in_progress')
  const [projectOpen, setProjectOpen] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [projectError, setProjectError] = useState<string>()

  /** Acción con «Deshacer»: el patrón para todo lo que cambia o destruye datos. */
  const withUndo = (done: string, undone: string, description?: string, icon?: IconName) =>
    notify.success(done, {
      description,
      icon,
      action: { label: 'Deshacer', onClick: () => notify.info(undone, { description }) },
    })

  const copyLink = async () => {
    const ok = await copyText(`${location.origin}/t/MUN-23`)
    if (ok) notify.success('Enlace copiado', { description: 'MUN-23', icon: 'link' })
    else notify.error('No se pudo copiar el enlace')
  }

  const moveTo = (k: keyof typeof columnKinds) => {
    if (k === column) return notify.info(`Ya está en ${KIND_LABEL[k]}`)
    const prev = column
    setColumn(k)
    notify.success(`Movida a ${KIND_LABEL[k]}`, {
      icon: 'move',
      description: 'Definir sistema de diseño',
      action: {
        label: 'Deshacer',
        onClick: () => {
          setColumn(prev)
          notify.info(`Devuelta a ${KIND_LABEL[prev]}`)
        },
      },
    })
  }

  const createProject = () => {
    const name = projectName.trim()
    if (!name) {
      setProjectError('Ponle un nombre al proyecto')
      return
    }
    setProjectOpen(false)
    setProjectName('')
    notify.success(`Proyecto «${name}» creado`, { description: 'con 5 columnas', icon: 'plus' })
  }

  useEffect(() => applyAppearance(appearance), [appearance])

  return (
    <div className="flex min-h-screen flex-wrap">
      <aside className="glass-sidebar flex min-h-screen w-60 flex-none flex-col gap-4 border-r border-border-subtle px-2.5 py-3.5">
        <div className="flex items-center gap-2.5 px-2 py-1">
          <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
            <rect width="26" height="26" rx="5" className="fill-accent" />
            <path d="M6 17.5 11.5 8.5l8 1.6-3.6 2.6 3.6 4.8z" className="fill-accent-fg" />
            <circle cx="13.6" cy="11.4" r="1.3" className="fill-accent" />
          </svg>
          <span className="text-md font-semibold tracking-tight">Muninn</span>
        </div>
        <nav aria-label="Principal" className="flex flex-col gap-0.5">
          {NAV.map((item, i) => (
            <a
              key={item.icon}
              href="#fundamentos"
              aria-current={i === 0 ? 'page' : undefined}
              className={`flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13.5px] font-medium ${
                i === 0
                  ? 'bg-surface-raised text-fg'
                  : 'text-fg-muted hover:bg-surface-hover hover:text-fg'
              }`}
            >
              <Icon name={item.icon} className={i === 0 ? 'text-accent' : 'text-fg-faint'} />
              {item.label}
            </a>
          ))}
        </nav>
        <div className="mt-auto flex items-center gap-2.5 border-t border-border-subtle px-2 pt-3">
          <Avatar name="Alex López" />
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-medium">Alex López</span>
            <span className="text-xs text-fg-faint">Datos: {backendLabel}</span>
          </div>
        </div>
      </aside>

      <main id="fundamentos" className="flex min-w-0 flex-[999_1_560px] flex-col gap-6 px-8 py-7">
        <header className="flex flex-wrap items-end gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Fundamentos</h1>
            <p className="text-fg-muted">Tokens y componentes de @muninn/ui con el tema real.</p>
          </div>
          <div className="ml-auto flex items-center gap-5">
            <label htmlFor="glass" className="flex items-center gap-2.5 text-sm font-medium">
              <Icon name="glass" className="text-fg-subtle" />
              Cristal
              <Switch
                id="glass"
                checked={appearance.glass}
                onCheckedChange={(glass) => setAppearance((a) => ({ ...a, glass }))}
              />
            </label>
            <fieldset className="flex items-center gap-2">
              <legend className="sr-only">Color de acento</legend>
              {(Object.keys(ACCENTS) as AccentName[]).map((name) => (
                <button
                  key={name}
                  type="button"
                  aria-label={`Acento ${name}`}
                  aria-pressed={appearance.accent === name}
                  onClick={() => setAppearance((a) => ({ ...a, accent: name }))}
                  className="size-[22px] cursor-pointer rounded-md aria-pressed:ring-2 aria-pressed:ring-fg aria-pressed:ring-offset-2 aria-pressed:ring-offset-bg"
                  style={{ background: ACCENTS[name] }}
                />
              ))}
            </fieldset>
          </div>
        </header>

        <div className="grid gap-3 xl:grid-cols-2">
          <Card className="p-5">
            <h2 className={sectionTitle}>Botones</h2>
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <Button variant="primary">
                  <Icon name="plus" />
                  Nueva tarea
                  <Kbd className="border-accent-fg/25 text-accent-fg">N</Kbd>
                </Button>
                <Button>
                  <Icon name="assistant" className="text-accent" />
                  Preguntar a Muninn
                </Button>
                <Button variant="ghost">Cancelar</Button>
                <Button variant="danger">
                  <Icon name="archive" />
                  Archivar
                </Button>
                <Button disabled>Deshabilitado</Button>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <Button size="sm">Pequeño</Button>
                <Button size="md">Mediano</Button>
                <Button size="lg" variant="primary">
                  Táctil 44 px
                </Button>
                <Tooltip content="Buscar (⌘K)">
                  <IconButton aria-label="Buscar" icon={<Icon name="search" />} />
                </Tooltip>
                <Tooltip content="Filtrar">
                  <IconButton
                    aria-label="Filtrar"
                    variant="secondary"
                    icon={<Icon name="filter" />}
                  />
                </Tooltip>
                <IconButton
                  aria-label="Nueva nota"
                  variant="primary"
                  size="lg"
                  icon={<Icon name="plus" size={18} />}
                />
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className={sectionTitle}>Etiquetas y estado</h2>
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                <Chip dot="blue">Muninn</Chip>
                <Chip dot="violet">HuginnDB</Chip>
                <Chip variant="accent" icon={<Icon name="flag" size={12} />}>
                  Alta
                </Chip>
                <Chip variant="danger">Vencida · 17 oct</Chip>
                <Chip variant="success">CI ✓</Chip>
                <Chip variant="outline">Media</Chip>
                <Chip icon={<Icon name="github" size={12} />}>GitHub</Chip>
              </div>
              <div className="flex flex-wrap gap-4">
                {(Object.keys(columnKinds) as (keyof typeof columnKinds)[]).map((k) => (
                  <span key={k} className="flex items-center gap-1.5 text-xs text-fg-subtle">
                    <ColorDot color={columnKinds[k]} />
                    {KIND_LABEL[k]}
                  </span>
                ))}
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-sm">
                  <ColorDot color="blue" />
                  Muninn
                  <span className="ml-auto text-xs text-fg-subtle">9 de 23</span>
                </div>
                <ProgressBar label="Progreso de Muninn" value={9 / 23} color="blue" />
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className={sectionTitle}>Formularios</h2>
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-3">
                <SegmentedControl
                  aria-label="Vista"
                  value={view}
                  onValueChange={setView}
                  options={[
                    { value: 'board', label: 'Tablero', icon: <Icon name="projects" size={14} /> },
                    { value: 'list', label: 'Lista' },
                    {
                      value: 'calendar',
                      label: 'Calendario',
                      icon: <Icon name="calendar" size={14} />,
                    },
                  ]}
                />
              </div>
              <SegmentedControl
                aria-label="Tipo de movimiento"
                fill
                size="lg"
                value={kind}
                onValueChange={setKind}
                options={[
                  { value: 'expense', label: 'Gasto' },
                  { value: 'income', label: 'Ingreso' },
                  { value: 'saving', label: 'Ahorro' },
                  { value: 'investment', label: 'Inversión' },
                ]}
              />
              <TextField
                label="Buscar"
                hideLabel
                placeholder="Filtrar tareas…"
                leading={<Icon name="search" size={14} />}
              />
              {/* Campos con etiqueta visible en la misma fila: las cajas quedan alineadas. */}
              <div className="grid items-start gap-3 sm:grid-cols-2">
                <TextField
                  label="Concepto"
                  placeholder="Cine + palomitas"
                  hint="Lo verás en la lista"
                />
                <AmountField
                  label="Importe"
                  valueCents={amount}
                  onValueChange={setAmount}
                  hint={amount === null ? 'Sin importe' : `${amount} céntimos`}
                  className="tabular"
                />
                <TextField label="Proyecto" defaultValue="Muninn" />
                <TextField
                  label="Repositorio"
                  defaultValue="huginndb"
                  error="Formato esperado: owner/repo"
                />
              </div>
              <TextArea label="Descripción" placeholder="Markdown…" rows={3} />
              <div className="flex flex-wrap items-center gap-6 text-sm">
                <label htmlFor="cb-done" className="flex items-center gap-2.5">
                  <Checkbox id="cb-done" checked={done} onCheckedChange={setDone} />
                  Tarea completada
                </label>
                <label htmlFor="cb-lg" className="flex items-center gap-2.5">
                  <Checkbox
                    id="cb-lg"
                    size="lg"
                    touch
                    checked={!done}
                    onCheckedChange={(v) => setDone(!v)}
                  />
                  Grande (móvil)
                </label>
                <label htmlFor="sw-notify" className="flex items-center gap-2.5">
                  <Switch id="sw-notify" checked={pushOn} onCheckedChange={setPushOn} />
                  Notificaciones
                </label>
              </div>
            </div>
          </Card>

          <Card className="flex flex-col">
            <CardHeader
              title="Superposiciones"
              description="Diálogo, panel lateral, hoja inferior y menú"
              action={
                <Menu>
                  <MenuTrigger asChild>
                    <IconButton aria-label="Más acciones" icon={<Icon name="dots" />} />
                  </MenuTrigger>
                  <MenuContent>
                    <MenuLabel>Tarea</MenuLabel>
                    <MenuItem icon={<Icon name="link" />} shortcut="L" onSelect={copyLink}>
                      Copiar enlace
                    </MenuItem>
                    <MenuItem
                      icon={<Icon name="pin" />}
                      onSelect={() =>
                        notify.success('Tarea fijada', {
                          icon: 'pin',
                          description: 'Aparecerá arriba en Inicio',
                        })
                      }
                    >
                      Fijar
                    </MenuItem>
                    <MenuItem
                      icon={<Icon name="assistant" />}
                      onSelect={() => notify.info('Abriendo el asistente…', { icon: 'assistant' })}
                    >
                      Preguntar a Muninn
                    </MenuItem>
                    <MenuSeparator />
                    <MenuItem
                      icon={<Icon name="archive" />}
                      shortcut="E"
                      onSelect={() =>
                        withUndo('Tarea archivada', 'Tarea restaurada', undefined, 'archive')
                      }
                    >
                      Archivar
                    </MenuItem>
                    <MenuItem
                      danger
                      icon={<Icon name="trash" />}
                      onSelect={() =>
                        withUndo('Tarea borrada', 'Tarea recuperada', undefined, 'trash')
                      }
                    >
                      Borrar
                    </MenuItem>
                  </MenuContent>
                </Menu>
              }
            />
            <div className="flex flex-wrap gap-2.5 px-4 pb-4">
              <Dialog
                open={projectOpen}
                onOpenChange={(open) => {
                  setProjectOpen(open)
                  if (!open) {
                    setProjectName('')
                    setProjectError(undefined)
                  }
                }}
              >
                <DialogTrigger asChild>
                  <Button variant="primary">Nuevo proyecto</Button>
                </DialogTrigger>
                <DialogContent
                  title="Nuevo proyecto"
                  description="Se crea con el tablero por defecto: Backlog, Pendiente, En curso, Revisión y Hecho."
                  footer={
                    <>
                      <DialogClose asChild>
                        <Button variant="ghost">Cancelar</Button>
                      </DialogClose>
                      <Button variant="primary" onClick={createProject}>
                        Crear proyecto
                      </Button>
                    </>
                  }
                >
                  <TextField
                    label="Nombre"
                    placeholder="Muninn"
                    autoFocus
                    value={projectName}
                    error={projectError}
                    onChange={(e) => {
                      setProjectName(e.target.value)
                      setProjectError(undefined)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') createProject()
                    }}
                  />
                  <TextField
                    label="Repositorio de GitHub"
                    placeholder="owner/repo"
                    hint="Opcional"
                  />
                </DialogContent>
              </Dialog>
              <Dialog>
                <DialogTrigger asChild>
                  <Button>Detalle de tarea</Button>
                </DialogTrigger>
                <SheetContent
                  title="Muninn › En curso"
                  toolbar={
                    <Tooltip content="Copiar enlace">
                      <IconButton
                        aria-label="Copiar enlace"
                        icon={<Icon name="link" />}
                        onClick={copyLink}
                      />
                    </Tooltip>
                  }
                  footer={
                    <>
                      <TextField
                        label="Preguntar"
                        hideLabel
                        className="flex-1"
                        placeholder="Pide algo a Muninn sobre esta tarea…"
                        leading={<Icon name="assistant" size={14} className="text-accent" />}
                      />
                      <DialogClose asChild>
                        <Button
                          variant="primary"
                          onClick={() =>
                            withUndo(
                              'Tarea completada',
                              'Tarea reabierta',
                              'Definir sistema de diseño',
                            )
                          }
                        >
                          Completar
                        </Button>
                      </DialogClose>
                    </>
                  }
                >
                  <h2 className="text-xl font-semibold tracking-tight">
                    Definir sistema de diseño
                  </h2>
                  <div className="mt-3 flex gap-2">
                    <Chip dot="amber">En curso</Chip>
                    <Chip variant="accent">Alta</Chip>
                    <Chip>Hoy, 19 oct</Chip>
                  </div>
                  <p className="mt-4 leading-relaxed text-fg-muted">
                    Pasar los fundamentos del diseño a código y construir los componentes base.
                  </p>
                  <div className="mt-5 flex items-center gap-2.5 text-xs text-fg-subtle">
                    Subtareas 3 de 5
                    <ProgressBar label="Subtareas" value={0.6} className="flex-1" />
                  </div>
                </SheetContent>
              </Dialog>
              <Dialog>
                <DialogTrigger asChild>
                  <Button>Hoja (móvil)</Button>
                </DialogTrigger>
                <SheetContent side="bottom" title="Mover a…">
                  <div className="flex flex-col gap-1">
                    {(Object.keys(columnKinds) as (keyof typeof columnKinds)[]).map((k) => (
                      <DialogClose asChild key={k}>
                        <Button
                          variant="ghost"
                          size="lg"
                          className="justify-start"
                          onClick={() => moveTo(k)}
                        >
                          <ColorDot color={columnKinds[k]} />
                          {KIND_LABEL[k]}
                          {k === column ? (
                            <Icon name="check" className="ml-auto text-accent" />
                          ) : null}
                        </Button>
                      </DialogClose>
                    ))}
                  </div>
                </SheetContent>
              </Dialog>
            </div>
          </Card>

          <Card className="p-5 xl:col-span-2">
            <h2 className={sectionTitle}>Notificaciones</h2>
            <div className="flex flex-wrap items-center gap-2.5">
              <Button onClick={() => notify.success('Cambios guardados')}>
                <Icon name="check" className="text-success" />
                Éxito
              </Button>
              <Button
                onClick={() =>
                  notify.error('No se pudo sincronizar', {
                    description: 'Sin conexión con Supabase',
                  })
                }
              >
                <Icon name="warning" className="text-danger" />
                Error
              </Button>
              <Button onClick={() => notify.info('Hay 6 noticias nuevas')}>
                <Icon name="info" className="text-accent" />
                Información
              </Button>
              <Button
                onClick={() =>
                  withUndo(
                    'Movimiento guardado',
                    'Movimiento eliminado',
                    '24,90 € · Ocio',
                    'finance',
                  )
                }
              >
                <Icon name="recurring" />
                Con deshacer
              </Button>
              <Button
                onClick={() =>
                  notify
                    .promise(new Promise<string>((r) => setTimeout(() => r('huginndb'), 1600)), {
                      loading: 'Sincronizando con GitHub…',
                      success: (repo) => `${repo}: 3 issues nuevas`,
                      error: 'No se pudo sincronizar',
                    })
                    .catch(() => {})
                }
              >
                <Icon name="sync" />
                Promesa
              </Button>
              <p className="text-xs text-fg-subtle">
                Aparecen arriba en el centro. Pasa el ratón para verlas apiladas; desliza para
                descartarlas.
              </p>
            </div>
            <h3 className="mt-5 mb-3 text-xs font-medium text-fg-subtle">
              Gesto de cada acción antes de confirmar
            </h3>
            <div className="flex flex-wrap gap-2">
              {ACTION_DEMOS.map((d) => (
                <Button
                  key={d.icon}
                  size="sm"
                  variant="ghost"
                  onClick={() => notify.success(d.title, { icon: d.icon, description: d.motion })}
                >
                  <Icon name={d.icon} />
                  {d.title}
                </Button>
              ))}
            </div>
          </Card>
        </div>

        <Card className="p-5">
          <h2 className={sectionTitle}>Color</h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3">
            {Object.entries(colors).map(([name, value]) => (
              <div key={name} className="flex flex-col gap-1.5 text-xs">
                <span
                  className="h-10 rounded-lg border border-border"
                  style={{ background: value }}
                />
                <span className="font-medium">{name}</span>
                <span className="font-mono text-2xs text-fg-subtle">{value}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className={sectionTitle}>Iconos · Phosphor ({Object.keys(icons).length})</h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2">
            {(Object.keys(icons) as IconName[]).map((name) => (
              <div
                key={name}
                className="flex flex-col items-center gap-2 rounded-md py-3 text-2xs text-fg-subtle hover:bg-surface-hover hover:text-fg"
              >
                <Icon name={name} size={20} />
                {name}
              </div>
            ))}
          </div>
        </Card>
      </main>
    </div>
  )
}
