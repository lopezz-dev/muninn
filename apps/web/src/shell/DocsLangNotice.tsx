import { Button, icons } from '@muninn/ui'
import { useNavigate, useParams, useRouterState } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { browserLocale } from '../i18n/locale'
import { docLangOf, translatedDocPath } from '../lib/doc-slugs'

const KEY = 'muninn.docsLangNotice'

const answered = () => {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

const remember = () => {
  try {
    localStorage.setItem(KEY, '1')
  } catch {
    // Sin almacenamiento, el aviso vuelve en la próxima visita: no pasa nada.
  }
}

/**
 * «Esta página también está en español» (ADR-0077): si el navegador habla el otro idioma, se ofrece la misma guía
 * traducida, sin redirigir. Sale en el idioma de quien lo lee, abajo a la derecha (abajo en el móvil); es la única
 * excepción a la posición de los avisos (ADR-0019). Cualquier respuesta se recuerda en el dispositivo.
 */
export function DocsLangNotice() {
  const { i18n } = useTranslation()
  const navigate = useNavigate()
  const lang = useRouterState({ select: (s) => docLangOf(s.location.pathname) })
  const slug = useParams({ strict: false }).pagina
  const [hidden, setHidden] = useState(answered)
  const visitor = browserLocale()
  if (hidden || visitor === lang) return null

  // Los textos de `common` están en los dos idiomas desde el arranque.
  const t = i18n.getFixedT(visitor, 'common')
  const close = () => {
    remember()
    setHidden(true)
  }

  return (
    <aside
      lang={visitor}
      aria-label={t('publicShell.langNotice.text')}
      className="glass-floating fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+12px)] z-40 flex flex-col gap-3 rounded-lg border border-border p-4 shadow-lg sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[340px]"
    >
      <p className="flex items-center gap-2 text-md text-fg">
        <icons.globe size={18} aria-hidden="true" className="shrink-0 text-accent" />
        {t('publicShell.langNotice.text')}
      </p>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={close}>
          {t('publicShell.langNotice.dismiss')}
        </Button>
        <Button
          variant="primary"
          onClick={() => {
            close()
            void navigate({ href: translatedDocPath(lang, slug) })
          }}
        >
          {t('publicShell.langNotice.switch')}
        </Button>
      </div>
    </aside>
  )
}
