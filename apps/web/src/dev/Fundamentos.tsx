import {
  ACCENTS,
  type AccentName,
  type Appearance,
  applyAppearance,
  colors,
  columnKinds,
  DEFAULT_APPEARANCE,
  Icon,
  type IconName,
  icons,
  palette,
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

/** Página de desarrollo: los tokens de Fundamentos renderizados con el tema real. */
export function Fundamentos() {
  const [appearance, setAppearance] = useState<Appearance>(DEFAULT_APPEARANCE)
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
        <p className="mt-auto px-2.5 text-xs text-fg-faint">Datos: {backendLabel}</p>
      </aside>

      <main id="fundamentos" className="flex min-w-0 flex-[999_1_560px] flex-col gap-6 px-8 py-7">
        <header className="flex flex-wrap items-end gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Fundamentos</h1>
            <p className="text-fg-muted">Tokens de @muninn/ui renderizados con el tema real.</p>
          </div>
          <div className="ml-auto flex items-center gap-5">
            <label className="flex items-center gap-2.5 text-sm font-medium">
              <Icon name="glass" className="text-fg-subtle" />
              Cristal
              <button
                type="button"
                role="switch"
                aria-checked={appearance.glass}
                onClick={() => setAppearance((a) => ({ ...a, glass: !a.glass }))}
                className={`flex h-5 w-[34px] rounded-full p-0.5 transition-colors ${
                  appearance.glass ? 'justify-end bg-accent' : 'bg-border-strong'
                }`}
              >
                <span className="size-4 rounded-full bg-fg" />
              </button>
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
                  className="size-[22px] rounded-md aria-pressed:ring-2 aria-pressed:ring-fg aria-pressed:ring-offset-2 aria-pressed:ring-offset-bg"
                  style={{ background: ACCENTS[name] }}
                />
              ))}
            </fieldset>
          </div>
        </header>

        <section aria-labelledby="t-color" className="glass rounded-lg border border-border p-5">
          <h2
            id="t-color"
            className="mb-4 text-xs font-semibold uppercase tracking-wider text-fg-subtle"
          >
            Color
          </h2>
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
          <div className="mt-5 flex flex-wrap gap-4 text-sm text-fg-muted">
            {Object.entries(palette).map(([name, value]) => (
              <span key={name} className="flex items-center gap-1.5">
                <span className="size-2 rounded-xs" style={{ background: value }} />
                {name}
              </span>
            ))}
          </div>
        </section>

        <div className="grid gap-3 lg:grid-cols-2">
          <section
            aria-labelledby="t-type"
            className="glass flex flex-col gap-3 rounded-lg border border-border p-5"
          >
            <h2
              id="t-type"
              className="text-xs font-semibold uppercase tracking-wider text-fg-subtle"
            >
              Tipografía
            </h2>
            <p className="text-2xl font-semibold tracking-tight">Buenos días, Alex</p>
            <p className="text-md font-semibold">Título de tarjeta</p>
            <p className="text-base text-fg-muted">
              Texto de lectura para notas y respuestas del asistente.
            </p>
            <p className="text-xs font-medium text-fg-subtle">Etiqueta · metadato</p>
            <p className="tabular font-mono text-xl font-medium">1.284,30 €</p>
          </section>

          <section
            aria-labelledby="t-comp"
            className="glass flex flex-col gap-4 rounded-lg border border-border p-5"
          >
            <h2
              id="t-comp"
              className="text-xs font-semibold uppercase tracking-wider text-fg-subtle"
            >
              Componentes
            </h2>
            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-medium text-accent-fg hover:bg-accent-hover"
              >
                <Icon name="plus" />
                Nueva tarea
              </button>
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border-strong bg-surface-raised px-3 text-sm font-medium hover:bg-surface-hover"
              >
                <Icon name="assistant" className="text-accent" />
                Preguntar a Muninn
              </button>
              <button
                type="button"
                className="inline-flex h-8 items-center rounded-md px-3 text-sm font-medium text-fg-muted hover:bg-surface-hover"
              >
                Fantasma
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex h-[22px] items-center gap-1.5 rounded-sm bg-surface-raised px-2 text-xs font-medium text-fg-muted">
                <span className="size-2 rounded-xs bg-project-blue" />
                Muninn
              </span>
              <span className="inline-flex h-[22px] items-center rounded-sm border border-accent/35 px-2 text-xs font-medium text-accent">
                Alta
              </span>
              <span className="inline-flex h-[22px] items-center rounded-sm bg-danger-soft px-2 text-xs font-medium text-danger">
                Vencida
              </span>
              <span className="inline-flex h-[22px] items-center gap-1.5 rounded-sm bg-surface-raised px-2 text-xs font-medium text-fg-muted">
                <Icon name="github" size={12} />
                GitHub
              </span>
            </div>
            <div className="flex gap-3">
              {(Object.keys(columnKinds) as (keyof typeof columnKinds)[]).map((k) => (
                <span key={k} className="flex items-center gap-1.5 text-xs text-fg-subtle">
                  <span className="size-2 rounded-xs" style={{ background: columnKinds[k] }} />
                  {KIND_LABEL[k]}
                </span>
              ))}
            </div>
            <article className="glass-raised flex w-72 flex-col gap-2 rounded-md border border-border-strong p-3 text-[13.5px] shadow-drag">
              <span className="w-fit rounded-sm bg-surface-sunken px-1.5 text-2xs text-fg-muted">
                diseño
              </span>
              Definir sistema de diseño
              <span className="h-[3px] rounded-full bg-border">
                <span className="block h-[3px] w-3/5 rounded-full bg-accent" />
              </span>
              <span className="flex gap-2.5 text-xs text-fg-subtle">
                <span className="text-accent">Hoy</span>3/5
                <span className="ml-auto flex items-center gap-1 text-accent">
                  <Icon name="flag" size={13} />
                  Alta
                </span>
              </span>
            </article>
          </section>
        </div>

        <section aria-labelledby="t-icons" className="glass rounded-lg border border-border p-5">
          <h2
            id="t-icons"
            className="mb-4 text-xs font-semibold uppercase tracking-wider text-fg-subtle"
          >
            Iconos · Phosphor ({Object.keys(icons).length})
          </h2>
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
        </section>
      </main>
    </div>
  )
}
