import { desktopDeviceName, sessionDeviceLabel } from './account'

/**
 * Aviso por correo al entrar desde un dispositivo sin nombre o nuevo (ADR-0080). Lo ejecuta el cron de la Edge Function
 * `security` con la service role, para todas las cuentas a la vez; aquí se decide qué apuntar y a quién escribir, y la
 * función solo lee secretos y envía. Sin Supabase: lo que lee y escribe llega inyectado (`LoginAlertDeps`), así que se
 * prueba en memoria.
 *
 * Un dispositivo se reconoce por su **nombre**: el del equipo en la app de escritorio (ADR-0081), el que le pusiste en la
 * lista y recuerda el navegador (ADR-0082), o el de la app conectada. Quien entra sin permiso no tiene ninguno, así que
 * una sesión sin nombre siempre avisa. Como mucho **un correo al día por cuenta** (Resend en plan gratuito): lo de ese
 * día va junto en el mismo correo y lo que llegue después solo se apunta.
 */

/** Una sesión que el cron aún no ha mirado (`login_alert_pending()`). */
export interface PendingLogin {
  sessionId: string
  ownerId: string
  createdAt: string
  userAgent: string | null
  ip: string | null
  /** La app OAuth que abrió la sesión (claude.ai → «Claude»), si la hay. */
  appName: string | null
  /** El nombre que le pusiste a la sesión (`session_names`), si lo tiene. */
  deviceName: string | null
  email: string | null
  /** `preferences.locale` de la cuenta. */
  locale: string | null
  /** `preferences.loginAlerts` (activado salvo `false`). */
  enabled: boolean
  /** El último aviso que se le mandó a la cuenta, para el tope diario. */
  lastEmailedAt: string | null
}

/** Lo que se apunta en `login_alert_log` y, si tiene nombre, en `known_devices`. */
export interface LoginRecord {
  sessionId: string
  ownerId: string
  deviceKey: string | null
  seenAt: string
  emailed: boolean
}

export interface LoginAlertMail {
  to: string
  subject: string
  text: string
  html: string
}

/** Envía un correo. Lo pone la Edge Function con la API de Resend; los tests, uno falso. Lanza si no sale. */
export type MailSender = (mail: LoginAlertMail) => Promise<void>

export interface LoginAlertDeps {
  pending: () => Promise<PendingLogin[]>
  /** Los dispositivos con nombre ya conocidos de esas cuentas. */
  known: (ownerIds: string[]) => Promise<Array<{ ownerId: string; deviceKey: string }>>
  record: (rows: LoginRecord[]) => Promise<void>
  send: MailSender
  /** Dirección de la app para el enlace a Ajustes (sin barra final). */
  appUrl: string
  timeZone: string
  /** Ahora (ISO); por defecto, el reloj. */
  now?: () => string
}

export interface LoginAlertSummary {
  /** Sesiones apuntadas sin correo (conocidas, primera pasada, aviso desactivado o tope del día). */
  recorded: number
  /** Correos enviados (uno por cuenta como mucho). */
  emailed: number
  /** Sesiones que habrían avisado pero la cuenta ya recibió un correo en las últimas 24 h. */
  capped: number
  /** Correos que no salieron: esas sesiones no se apuntan y se reintentan en la siguiente pasada. */
  failed: number
}

const DAY_MS = 86_400_000

/**
 * La huella del dispositivo: su nombre (el del equipo, el que le pusiste o el de la app conectada). `null` si no tiene:
 * con el tipo («Windows · Chrome») no basta, porque dos equipos distintos lo comparten.
 */
export function loginDeviceKey(
  login: Pick<PendingLogin, 'userAgent' | 'appName' | 'deviceName'>,
): string | null {
  const name =
    login.deviceName?.trim() ||
    desktopDeviceName(login.userAgent) ||
    (login.appName ? sessionDeviceLabel(null, login.appName) : null)
  return name ? name.slice(0, 120) : null
}

export type LoginDecision = 'seed' | 'known' | 'muted' | 'alert'

/**
 * Qué hacer con cada sesión, en orden de llegada:
 * - `seed`: la cuenta aún no tenía ningún dispositivo conocido (primera pasada tras desplegar o cuenta nueva). Se apunta
 *   sin avisar.
 * - `known`: tiene un nombre que ya se había usado.
 * - `muted`: habría avisado, pero la cuenta tiene el aviso desactivado (o no tiene correo). Se apunta igual.
 * - `alert`: no tiene nombre, o tiene uno nuevo.
 * Dos sesiones del mismo nombre nuevo en la misma pasada dan un solo aviso.
 */
export function planLoginAlerts(
  pending: PendingLogin[],
  known: Array<{ ownerId: string; deviceKey: string }>,
): Array<{ login: PendingLogin; deviceKey: string | null; decision: LoginDecision }> {
  const byOwner = new Map<string, Set<string>>()
  for (const k of known) {
    const set = byOwner.get(k.ownerId) ?? new Set<string>()
    set.add(k.deviceKey)
    byOwner.set(k.ownerId, set)
  }
  // Las cuentas sin nada conocido al empezar la pasada: todo lo suyo de esta pasada es «lo que ya había».
  const seeding = new Set(pending.map((p) => p.ownerId).filter((o) => !byOwner.has(o)))
  return [...pending]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((login) => {
      const deviceKey = loginDeviceKey(login)
      const set = byOwner.get(login.ownerId) ?? new Set<string>()
      byOwner.set(login.ownerId, set)
      const seen = deviceKey !== null && set.has(deviceKey)
      if (deviceKey) set.add(deviceKey)
      const decision: LoginDecision = seeding.has(login.ownerId)
        ? 'seed'
        : seen
          ? 'known'
          : !login.enabled || !login.email
            ? 'muted'
            : 'alert'
      return { login, deviceKey, decision }
    })
}

const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  )

/** «Portátil del curro (Windows · Chrome)», o solo el tipo si no tiene nombre. */
const describe = (login: PendingLogin) => {
  const kind = sessionDeviceLabel(login.userAgent, login.appName)
  const name = login.deviceName?.trim()
  return name ? `${name} (${kind})` : kind
}

/**
 * El correo del aviso para una cuenta, con todas sus sesiones de esta pasada, en el idioma de la cuenta (inglés salvo
 * `es`, ADR-0077).
 */
export function loginAlertMail(
  logins: PendingLogin[],
  { appUrl, timeZone }: Pick<LoginAlertDeps, 'appUrl' | 'timeZone'>,
): LoginAlertMail {
  const first = logins[0]
  if (!first) throw new Error('Sin sesiones de las que avisar')
  const es = first.locale?.toLowerCase().startsWith('es') ?? false
  const fmt = new Intl.DateTimeFormat(es ? 'es-ES' : 'en-GB', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone,
  })
  const link = `${appUrl.replace(/\/+$/, '')}/ajustes/cuenta#ajuste-sesiones`
  const many = logins.length > 1
  const t = es
    ? {
        subject: many
          ? `${logins.length} inicios de sesión en Muninn que no reconocemos`
          : `Inicio de sesión en Muninn: ${describe(first)}`,
        intro: many
          ? 'Alguien ha entrado en tu cuenta de Muninn desde dispositivos que no reconocemos:'
          : 'Alguien ha entrado en tu cuenta de Muninn desde un dispositivo que no reconocemos:',
        device: 'Dispositivo',
        when: 'Cuándo',
        ip: 'IP',
        you: 'Si fuiste tú, ponle nombre a esa sesión en Ajustes › Cuenta › Sesiones y dispositivos (el lápiz de la fila) y no te volveremos a avisar de ella.',
        notYou: 'Si no fuiste tú, cierra esa sesión ahí mismo y activa el segundo factor:',
        open: 'Abrir Sesiones y dispositivos',
        footer: 'Como mucho te mandamos un aviso al día. Puedes desactivarlos en Ajustes › Cuenta.',
      }
    : {
        subject: many
          ? `${logins.length} sign-ins to Muninn we don’t recognise`
          : `Sign-in to Muninn: ${describe(first)}`,
        intro: many
          ? 'Someone signed in to your Muninn account from devices we don’t recognise:'
          : 'Someone signed in to your Muninn account from a device we don’t recognise:',
        device: 'Device',
        when: 'When',
        ip: 'IP',
        you: 'If this was you, name that session in Settings › Account › Sessions and devices (the pencil on its row) and we won’t alert you about it again.',
        notYou:
          'If it wasn’t you, sign that session out right there and turn on the second factor:',
        open: 'Open Sessions and devices',
        footer: 'We send at most one alert a day. You can turn them off in Settings › Account.',
      }
  const blocks = logins.map((l) => [
    [t.device, describe(l)] as [string, string],
    [t.when, fmt.format(new Date(l.createdAt))] as [string, string],
    ...(l.ip ? [[t.ip, l.ip] as [string, string]] : []),
  ])
  const text = [
    t.intro,
    '',
    ...blocks.flatMap((rows) => [...rows.map(([k, v]) => `${k}: ${v}`), '']),
    t.you,
    t.notYou,
    link,
    '',
    t.footer,
  ].join('\n')
  const table = (rows: Array<[string, string]>) =>
    `<table style="border-collapse:collapse;margin:0 0 12px">${rows
      .map(
        ([k, v]) =>
          `<tr><td style="padding:2px 12px 2px 0;color:#6b6b73">${escapeHtml(k)}</td><td><strong>${escapeHtml(v)}</strong></td></tr>`,
      )
      .join('')}</table>`
  const html = `<!doctype html><html lang="${es ? 'es' : 'en'}"><body style="font-family:system-ui,sans-serif;color:#1c1c1f;line-height:1.5">
<p>${escapeHtml(t.intro)}</p>
${blocks.map(table).join('\n')}
<p>${escapeHtml(t.you)}</p>
<p>${escapeHtml(t.notYou)}<br><a href="${escapeHtml(link)}">${escapeHtml(t.open)}</a></p>
<p style="color:#6b6b73;font-size:13px">${escapeHtml(t.footer)}</p>
</body></html>`
  return { to: first.email ?? '', subject: t.subject, text, html }
}

/**
 * Una pasada del cron: lee las sesiones nuevas, decide, envía y apunta. Lo que no avisa se apunta de una vez. Por cuenta,
 * las que avisan van en un solo correo; si la cuenta ya recibió uno en las últimas 24 h, solo se apuntan. Un correo que no
 * sale deja sin apuntar sus sesiones (y las del mismo nombre), así que se reintenta en la siguiente pasada.
 */
export async function runLoginAlerts(deps: LoginAlertDeps): Promise<LoginAlertSummary> {
  const summary: LoginAlertSummary = { recorded: 0, emailed: 0, capped: 0, failed: 0 }
  const pending = await deps.pending()
  if (!pending.length) return summary
  const now = Date.parse(deps.now?.() ?? new Date().toISOString())
  const owners = [...new Set(pending.map((p) => p.ownerId))]
  const plan = planLoginAlerts(pending, await deps.known(owners))
  type Step = (typeof plan)[number]
  const row = (p: Step, emailed: boolean): LoginRecord => ({
    sessionId: p.login.sessionId,
    ownerId: p.login.ownerId,
    deviceKey: p.deviceKey,
    seenAt: p.login.createdAt,
    emailed,
  })

  // Las demás sesiones de un nombre nuevo que se avisa en esta pasada van con su aviso: si el correo no sale, no pueden
  // dejarlo como conocido (la siguiente pasada no avisaría).
  const keyOf = (p: Step) => (p.deviceKey ? `${p.login.ownerId}\n${p.deviceKey}` : null)
  const alerts = plan.filter((p) => p.decision === 'alert')
  const alerting = new Set(alerts.map(keyOf).filter((k): k is string => k !== null))
  const followersOf = (group: Step[]) =>
    plan.filter((x) => {
      const k = keyOf(x)
      return x.decision !== 'alert' && k !== null && group.some((g) => keyOf(g) === k)
    })
  const quiet = plan.filter((p) => {
    const k = keyOf(p)
    return p.decision !== 'alert' && (k === null || !alerting.has(k))
  })
  if (quiet.length) {
    await deps.record(quiet.map((p) => row(p, false)))
    summary.recorded = quiet.length
  }

  const byOwner = new Map<string, Step[]>()
  for (const a of alerts) byOwner.set(a.login.ownerId, [...(byOwner.get(a.login.ownerId) ?? []), a])
  for (const group of byOwner.values()) {
    const followers = followersOf(group)
    const last = group[0]?.login.lastEmailedAt
    if (last && now - Date.parse(last) < DAY_MS) {
      await deps.record([...group, ...followers].map((p) => row(p, false)))
      summary.capped += group.length
      summary.recorded += followers.length
      continue
    }
    try {
      await deps.send(
        loginAlertMail(
          group.map((g) => g.login),
          deps,
        ),
      )
    } catch (err) {
      console.error(
        'login-alert',
        group[0]?.login.ownerId,
        err instanceof Error ? err.message : err,
      )
      summary.failed += group.length
      continue
    }
    await deps.record([...group.map((p) => row(p, true)), ...followers.map((p) => row(p, false))])
    summary.emailed++
    summary.recorded += followers.length
  }
  return summary
}
