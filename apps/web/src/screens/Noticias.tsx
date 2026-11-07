import type { NewsItem, NewsSource } from '@muninn/core'
import { Button, Card, Chip, cn, Icon, IconButton, icons, Switch, TextField } from '@muninn/ui'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState, Page, PageHeader } from '../components/Page'
import { useAssistantPrefs } from '../lib/assistant-settings'
import { clock, timeAgo } from '../lib/dates'
import { externalLink } from '../lib/external-link'
import { useEnabledModules } from '../lib/modules'
import { useAuth, useMuninn } from '../lib/muninn'
import {
  addSource,
  archiveSource,
  collapseRuns,
  filterNews,
  markRead,
  newSince,
  newsDigestQuery,
  newsItemsQuery,
  newsSourcesQuery,
  noteFromItem,
  refreshNews,
  SAVED_TAB,
  setSaved,
  setSourceEnabled,
  topicTabs,
} from '../lib/news'
import { generateDigestNow, generateTodayDigest } from '../lib/news-digest'
import { createNote } from '../lib/note-actions'
import { projectsQuery } from '../lib/queries'
import { Markdown } from '../markdown/Markdown'
import { useShell } from '../shell/shell-context'
import { SuggestedSourcesButton } from './noticias/SuggestedSources'

const route = getRouteApi('/_app/news')

/** El resumen del día (Noticias.dc.html): generado en el ordenador con el modelo local. */
function DigestCard({ hasItems }: { hasItems: boolean }) {
  const { t } = useTranslation('news')
  const m = useMuninn()
  const qc = useQueryClient()
  const prefs = useAssistantPrefs()
  const auth = useAuth()
  const digest = useQuery(newsDigestQuery(m, m.today())).data
  const [busy, setBusy] = useState(false)
  const tried = useRef(false)

  // La primera vez que se abre en el día, en el ordenador con Ollama, se genera solo (sin avisos si no hay modelo).
  useEffect(() => {
    if (tried.current || digest !== null || !hasItems || auth.kind === 'demo') return
    tried.current = true
    setBusy(true)
    void generateTodayDigest(m, qc, prefs)
      .catch(() => null)
      .finally(() => setBusy(false))
  }, [digest, hasItems, auth.kind, m, qc, prefs])

  const regenerate = async () => {
    setBusy(true)
    await generateDigestNow(m, qc, prefs)
    setBusy(false)
  }

  return (
    <Card className="flex gap-3.5 p-[18px]">
      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-accent-soft text-accent">
        <Icon name="assistant" size={16} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <h2 className="text-md font-semibold">{t('digest.title')}</h2>
          {digest ? (
            <span className="text-xs text-fg-subtle">
              {t('digest.summarizedAt', { time: clock(digest.updatedAt) })}
            </span>
          ) : null}
          {auth.kind === 'user' && hasItems ? (
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto"
              onClick={regenerate}
              disabled={busy}
            >
              <Icon name="sync" size={13} />
              {busy
                ? t('digest.summarizingShort')
                : digest
                  ? t('digest.redo')
                  : t('digest.summarize')}
            </Button>
          ) : null}
        </div>
        {digest ? (
          <div className="text-sm leading-relaxed text-fg-muted">
            <Markdown source={digest.content} />
          </div>
        ) : (
          <p className="text-sm text-fg-muted text-pretty">
            {busy
              ? t('digest.summarizingLong')
              : hasItems
                ? t('digest.noneYet')
                : t('digest.empty')}
          </p>
        )}
      </div>
    </Card>
  )
}

interface ArticleProps {
  item: NewsItem
  source: NewsSource | undefined
  related: string[]
  tasksOn: boolean
  notesOn: boolean
  /** Filtra la lista por la fuente del artículo (al pulsar su nombre). */
  onSource: () => void
}

function Article({ item, source, related, tasksOn, notesOn, onSource }: ArticleProps) {
  const { t } = useTranslation('news')
  const m = useMuninn()
  const qc = useQueryClient()
  const shell = useShell()
  const act =
    'inline-flex h-[30px] cursor-pointer items-center gap-1.5 rounded-sm px-2 text-xs font-medium text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg'
  return (
    <article className="flex flex-col gap-2 border-t border-border-subtle px-[18px] py-4 first:border-t-0">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-subtle">
        <button
          type="button"
          className="cursor-pointer font-medium text-fg-muted hover:text-fg hover:underline"
          title={t('article.onlySource', { source: source?.title ?? t('article.thisSource') })}
          onClick={onSource}
        >
          {source?.title ?? t('article.source')}
        </button>
        · {timeAgo(item.publishedAt ?? item.fetchedAt)}
        {item.author ? ` · ${item.author}` : ''}
        {related.map((p) => (
          <Chip key={p} variant="accent" className="ml-auto">
            {t('article.related', { project: p })}
          </Chip>
        ))}
      </div>
      <h3 className={cn('text-md leading-snug font-semibold', item.readAt && 'text-fg-muted')}>
        <a
          {...externalLink(item.url, { onOpen: () => markRead(m, qc, item) })}
          className="hover:underline"
        >
          {item.title}
        </a>
      </h3>
      {item.summary ? (
        <p className="line-clamp-3 text-sm leading-relaxed text-fg-subtle">{item.summary}</p>
      ) : null}
      <div className="-ml-2 flex flex-wrap gap-0.5">
        {tasksOn ? (
          <button
            type="button"
            className={act}
            onClick={() => shell.openNewTask({ title: item.title, description: item.url })}
          >
            <Icon name="projects" size={14} />
            {t('article.createTask')}
          </button>
        ) : null}
        {notesOn ? (
          <button
            type="button"
            className={act}
            onClick={() =>
              void createNote(m, qc, {
                title: item.title,
                content: noteFromItem(item, source?.title),
              })
            }
          >
            <Icon name="notes" size={14} />
            {t('article.saveAsNote')}
          </button>
        ) : null}
        <button
          type="button"
          className={act}
          aria-pressed={Boolean(item.savedAt)}
          onClick={() => void setSaved(m, qc, item, !item.savedAt)}
        >
          <Icon name="pin" size={14} className={item.savedAt ? 'text-accent' : undefined} />
          {item.savedAt ? t('article.saved') : t('article.readLater')}
        </button>
        <a
          {...externalLink(item.url, { onOpen: () => markRead(m, qc, item), direct: true })}
          className={act}
        >
          <Icon name="external" size={14} />
          {t('article.open')}
        </a>
      </div>
    </article>
  )
}

/** Fuentes del usuario: activar o pausar, quitar (se archiva) y añadir un RSS. */
function Sources({ sources }: { sources: NewsSource[] }) {
  const { t } = useTranslation('news')
  const m = useMuninn()
  const qc = useQueryClient()
  const [url, setUrl] = useState('')
  const [topic, setTopic] = useState('')
  const [error, setError] = useState<string>()
  const [adding, setAdding] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const clean = url.trim()
    if (!/^https?:\/\/\S+$/i.test(clean)) return setError(t('sources.invalidUrl'))
    setAdding(true)
    const s = await addSource(m, qc, { url: clean, topic: topic.trim() || null })
    setAdding(false)
    if (s) {
      setUrl('')
      setTopic('')
    }
  }

  return (
    <Card className="flex flex-col px-[18px] py-4">
      <h2 className="pb-2.5 text-md font-semibold">{t('sources.title')}</h2>
      {sources.length ? (
        <ul>
          {sources.map((s) => (
            <li
              key={s.id}
              className="flex items-center gap-2.5 border-t border-border-subtle py-2.5 text-[13.5px] first:border-t-0"
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <span className={cn('truncate', !s.enabled && 'text-fg-subtle')}>{s.title}</span>
                {s.lastError ? (
                  <span className="truncate text-xs text-danger" title={s.lastError}>
                    {s.lastError}
                  </span>
                ) : s.topic ? (
                  <span className="truncate text-xs text-fg-faint">{s.topic}</span>
                ) : null}
              </div>
              <Switch
                checked={s.enabled}
                aria-label={t(s.enabled ? 'sources.pause' : 'sources.resume', { title: s.title })}
                onCheckedChange={(on) => void setSourceEnabled(m, qc, s, on)}
              />
              <IconButton
                aria-label={t('sources.remove', { title: s.title })}
                icon={<Icon name="archive" size={15} />}
                size="sm"
                onClick={() => void archiveSource(m, qc, s)}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-fg-subtle">{t('sources.none')}</p>
      )}
      <div className="mt-3 flex flex-col gap-1.5 border-t border-border-subtle pt-3">
        <SuggestedSourcesButton sources={sources} />
        <p className="text-xs text-fg-subtle">{t('sources.catalogHint')}</p>
      </div>
      <form
        onSubmit={submit}
        className="mt-3 flex flex-col gap-2.5 border-t border-border-subtle pt-3"
        noValidate
      >
        <TextField
          label={t('sources.addRss')}
          placeholder={t('sources.rssPlaceholder')}
          value={url}
          onChange={(e) => {
            setUrl(e.target.value)
            setError(undefined)
          }}
          error={error}
          inputMode="url"
          spellCheck={false}
        />
        <TextField
          label={t('sources.topic')}
          placeholder={t('sources.topicPlaceholder')}
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          maxLength={40}
        />
        <Button type="submit" disabled={adding}>
          <icons.plus size={14} />
          {t('sources.add')}
        </Button>
      </form>
      <p className="mt-3.5 rounded-md bg-surface-sunken p-3 text-[12.5px] leading-relaxed text-fg-muted">
        {t('sources.privacyBefore')}
        <strong className="font-semibold text-fg">{t('sources.privacyStrong')}</strong>
        {t('sources.privacyAfter')}
      </p>
    </Card>
  )
}

/** Noticias (Noticias.dc.html, ADR-0042): resumen del día, temas, artículos y fuentes. */
export function Noticias() {
  const { t } = useTranslation(['news', 'common'])
  const m = useMuninn()
  const qc = useQueryClient()
  const modules = useEnabledModules()
  const { q } = route.useSearch()
  const sources = useQuery(newsSourcesQuery(m)).data ?? []
  const itemsQ = useQuery(newsItemsQuery(m))
  const projects = useQuery(projectsQuery(m)).data ?? []
  const [tab, setTab] = useState<string | null>(null)
  const [onlySource, setOnlySource] = useState<string | null>(null)
  // Rachas de una misma fuente que el usuario ha desplegado («Ver N más de …»).
  const [openRuns, setOpenRuns] = useState<ReadonlySet<string>>(new Set())
  const [search, setSearch] = useState(q ?? '')
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => setSearch(q ?? ''), [q])

  const items = itemsQ.data ?? []
  const tabs = useMemo(() => topicTabs(items, sources), [items, sources])
  const visible = useMemo(
    () => filterNews(items, sources, { tab, source: onlySource, search }),
    [items, sources, tab, onlySource, search],
  )
  // Solo en «Todas» y sin buscar: ahí es donde una fuente muy activa tapa a las demás (ADR-0069).
  const rows = useMemo(
    () =>
      tab === null && !onlySource && !search.trim()
        ? collapseRuns(visible, openRuns)
        : visible.map((item) => ({ kind: 'item' as const, item })),
    [visible, tab, onlySource, search, openRuns],
  )
  const sourceById = useMemo(() => new Map(sources.map((s) => [s.id, s])), [sources])
  const pickTab = (next: string | null) => {
    setTab(next)
    setOnlySource(null)
  }
  const fresh = newSince(items)
  const savedCount = items.filter((i) => i.savedAt).length

  const refresh = async () => {
    setRefreshing(true)
    await refreshNews(m, qc)
    setRefreshing(false)
  }

  const tabClass = (on: boolean) =>
    cn(
      'h-7 cursor-pointer rounded-md border px-3 text-[12.5px] font-medium transition-colors',
      on
        ? 'border-border-strong bg-surface-raised text-fg'
        : 'border-border text-fg-muted hover:bg-surface-hover',
    )

  return (
    <Page>
      <PageHeader
        title={t('nav.news', { ns: 'common' })}
        description={items.length ? t('page.fresh', { count: fresh }) : t('page.tagline')}
        actions={
          <Button onClick={refresh} disabled={refreshing || !sources.length}>
            <Icon name="sync" size={15} />
            {refreshing ? t('page.refreshing') : t('page.refresh')}
          </Button>
        }
      />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-3.5">
          <DigestCard hasItems={items.length > 0} />

          {items.length ? (
            <>
              <div className="flex flex-wrap items-center gap-1.5">
                <div
                  role="tablist"
                  aria-label={t('page.topics')}
                  className="flex flex-wrap gap-1.5"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={tab === null}
                    className={tabClass(tab === null)}
                    onClick={() => pickTab(null)}
                  >
                    {t('page.all', { n: items.length })}
                  </button>
                  {tabs.map(([topic, n]) => (
                    <button
                      key={topic}
                      type="button"
                      role="tab"
                      aria-selected={tab === topic}
                      className={tabClass(tab === topic)}
                      onClick={() => pickTab(topic)}
                    >
                      {topic} · {n}
                    </button>
                  ))}
                  <button
                    type="button"
                    role="tab"
                    aria-selected={tab === SAVED_TAB}
                    className={tabClass(tab === SAVED_TAB)}
                    onClick={() => pickTab(SAVED_TAB)}
                  >
                    {savedCount ? t('page.savedCount', { n: savedCount }) : t('page.saved')}
                  </button>
                </div>
                {onlySource ? (
                  <button
                    type="button"
                    className={cn(tabClass(true), 'inline-flex items-center gap-1.5')}
                    aria-label={t('page.clearSourceFilter', {
                      source: sourceById.get(onlySource)?.title ?? t('page.aSource'),
                    })}
                    onClick={() => setOnlySource(null)}
                  >
                    {t('page.onlySource', {
                      source: sourceById.get(onlySource)?.title ?? t('page.aSource'),
                    })}
                    <Icon name="close" size={12} />
                  </button>
                ) : null}
                <TextField
                  label={t('page.search')}
                  hideLabel
                  placeholder={t('page.searchPlaceholder')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  leading={<Icon name="search" size={14} />}
                  className="w-full sm:ml-auto sm:w-56"
                />
              </div>
              {visible.length ? (
                <Card aria-label={t('page.articles')} className="overflow-hidden">
                  {rows.map((r) =>
                    r.kind === 'item' ? (
                      <Article
                        key={r.item.id}
                        item={r.item}
                        source={sourceById.get(r.item.sourceId)}
                        related={m.news.related(r.item, projects).map((p) => p.name)}
                        tasksOn={!modules || modules.has('tasks')}
                        notesOn={!modules || modules.has('notes')}
                        onSource={() => setOnlySource(r.item.sourceId)}
                      />
                    ) : (
                      <button
                        key={`more-${r.key}`}
                        type="button"
                        className="flex w-full cursor-pointer items-center gap-1.5 border-t border-border-subtle px-[18px] py-2.5 text-left text-xs font-medium text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg"
                        onClick={() => setOpenRuns((prev) => new Set(prev).add(r.key))}
                      >
                        <Icon name="chevronDown" size={14} />
                        {t('page.showMore', {
                          count: r.items.length,
                          source: sourceById.get(r.sourceId)?.title ?? t('article.thisSource'),
                        })}
                      </button>
                    ),
                  )}
                </Card>
              ) : (
                <p className="px-1 py-6 text-center text-sm text-fg-subtle">
                  {tab === SAVED_TAB ? t('page.noSaved') : t('page.noMatch')}
                </p>
              )}
            </>
          ) : itemsQ.isSuccess ? (
            <EmptyState
              icon="news"
              title={sources.length ? t('page.noArticlesYet') : t('page.pickSources')}
              actions={
                sources.length ? undefined : (
                  <SuggestedSourcesButton
                    sources={sources}
                    variant="primary"
                    label={t('page.seeOfficial')}
                  />
                )
              }
            >
              {sources.length ? t('page.waitHint') : t('page.startHint')}
            </EmptyState>
          ) : null}
        </div>
        <aside
          aria-label={t('sources.title')}
          className="w-full shrink-0 lg:sticky lg:top-7 lg:w-[300px]"
        >
          <Sources sources={sources} />
        </aside>
      </div>
    </Page>
  )
}
