import { sessionDeviceLabel } from './account'

/**
 * Aviso por correo al entrar desde un dispositivo nuevo (ADR-0080). Lo ejecuta el cron de la Edge Function `security`
 * con la service role, para todas las cuentas a la vez; aquí se decide qué apuntar y a quién escribir, y la función solo
 * lee secretos y envía. Sin Supabase: lo que lee y escribe llega inyectado (`LoginAlertDeps`), así que se prueba en memoria.
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
  email: string | null
  /** `preferences.locale` de la cuenta. */
  locale: string | null
  /** `preferences.loginAlerts` (activado salvo `false`). */
  enabled: boolean
}

/** Lo que se apunta en `login_alert_log` y en `known_devices`. */
export interface LoginRecord {
  sessionId: string
  ownerId: string
  deviceKey: string
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
  /** Los dispositivos ya conocidos de esas cuentas. */
  known: (ownerIds: string[]) => Promise<Array<{ ownerId: string; deviceKey: string }>>
  record: (rows: LoginRecord[]) => Promise<void>
  send: MailSender
  /** Dirección de la app para el enlace a Ajustes (sin barra final). */
  appUrl: string
  timeZone: string
}

export interface LoginAlertSummary {
  /** Sesiones apuntadas sin correo (dispositivo conocido, primera vez de la cuenta o aviso desactivado). */
  recorded: number
  emailed: number
  /** Correos que no salieron: esas sesiones no se apuntan y se reintentan en la siguiente pasada. */
  failed: number
}

/** La huella del dispositivo: el mismo nombre que enseña la lista de sesiones (sin la IP, que cambia a diario). */
export const loginDeviceKey = (login: Pick<PendingLogin, 'userAgent' | 'appName'>) =>
  sessionDeviceLabel(login.userAgent, login.appName).slice(0, 120)

export type LoginDecision = 'seed' | 'known' | 'muted' | 'alert'

/**
 * Qué hacer con cada sesión, en orden de llegada:
 * - `seed`: la cuenta aún no tenía ningún dispositivo conocido (primera pasada tras desplegar o cuenta nueva). Se apunta sin avisar.
 * - `known`: ese dispositivo ya se había usado.
 * - `muted`: es nuevo, pero la cuenta tiene el aviso desactivado (o no tiene correo). Se apunta igual.
 * - `alert`: es nuevo y hay que avisar.
 * Dos sesiones del mismo dispositivo nuevo en la misma pasada dan un solo aviso.
 */
export function planLoginAlerts(
  pending: PendingLogin[],
  known: Array<{ ownerId: string; deviceKey: string }>,
): Array<{ login: PendingLogin; deviceKey: string; decision: LoginDecision }> {
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
      const seen = set.has(deviceKey)
      set.add(deviceKey)
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

/** El correo del aviso, en el idioma de la cuenta (inglés salvo `es`, ADR-0077). */
export function loginAlertMail(
  login: PendingLogin,
  { appUrl, timeZone }: Pick<LoginAlertDeps, 'appUrl' | 'timeZone'>,
): LoginAlertMail {
  const es = login.locale?.toLowerCase().startsWith('es') ?? false
  const device = loginDeviceKey(login)
  const when = new Intl.DateTimeFormat(es ? 'es-ES' : 'en-GB', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone,
  }).format(new Date(login.createdAt))
  const link = `${appUrl.replace(/\/+$/, '')}/ajustes/cuenta#ajuste-sesiones`
  const t = es
    ? {
        subject: `Nuevo inicio de sesión en Muninn: ${device}`,
        intro:
          'Alguien ha entrado en tu cuenta de Muninn desde un dispositivo que no habías usado antes.',
        device: 'Dispositivo',
        when: 'Cuándo',
        ip: 'IP',
        you: 'Si fuiste tú, no hace falta que hagas nada.',
        notYou:
          'Si no fuiste tú, cierra esa sesión en Ajustes › Cuenta › Sesiones y dispositivos, y activa el segundo factor:',
        open: 'Abrir Sesiones y dispositivos',
        footer: 'Puedes desactivar estos avisos en Ajustes › Cuenta.',
      }
    : {
        subject: `New sign-in to Muninn: ${device}`,
        intro: 'Someone signed in to your Muninn account from a device you hadn’t used before.',
        device: 'Device',
        when: 'When',
        ip: 'IP',
        you: 'If this was you, you don’t need to do anything.',
        notYou:
          'If it wasn’t you, sign that session out in Settings › Account › Sessions and devices, and turn on the second factor:',
        open: 'Open Sessions and devices',
        footer: 'You can turn these alerts off in Settings › Account.',
      }
  const rows: Array<[string, string]> = [
    [t.device, device],
    [t.when, when],
    ...(login.ip ? ([[t.ip, login.ip]] as Array<[string, string]>) : []),
  ]
  const text = [
    t.intro,
    '',
    ...rows.map(([k, v]) => `${k}: ${v}`),
    '',
    t.you,
    t.notYou,
    link,
    '',
    t.footer,
  ].join('\n')
  const html = `<!doctype html><html lang="${es ? 'es' : 'en'}"><body style="font-family:system-ui,sans-serif;color:#1c1c1f;line-height:1.5">
<p>${escapeHtml(t.intro)}</p>
<table style="border-collapse:collapse">${rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:2px 12px 2px 0;color:#6b6b73">${escapeHtml(k)}</td><td><strong>${escapeHtml(v)}</strong></td></tr>`,
    )
    .join('')}</table>
<p>${escapeHtml(t.you)}</p>
<p>${escapeHtml(t.notYou)}<br><a href="${escapeHtml(link)}">${escapeHtml(t.open)}</a></p>
<p style="color:#6b6b73;font-size:13px">${escapeHtml(t.footer)}</p>
</body></html>`
  return { to: login.email ?? '', subject: t.subject, text, html }
}

/**
 * Una pasada del cron: lee las sesiones nuevas, decide, envía y apunta. Lo que no necesita correo se apunta de una vez;
 * cada correo se apunta solo si salió, así que un fallo de Resend se reintenta en la siguiente pasada.
 */
export async function runLoginAlerts(deps: LoginAlertDeps): Promise<LoginAlertSummary> {
  const summary: LoginAlertSummary = { recorded: 0, emailed: 0, failed: 0 }
  const pending = await deps.pending()
  if (!pending.length) return summary
  const owners = [...new Set(pending.map((p) => p.ownerId))]
  const plan = planLoginAlerts(pending, await deps.known(owners))
  const row = (p: (typeof plan)[number], emailed: boolean): LoginRecord => ({
    sessionId: p.login.sessionId,
    ownerId: p.login.ownerId,
    deviceKey: p.deviceKey,
    seenAt: p.login.createdAt,
    emailed,
  })

  // Las demás sesiones de un dispositivo que se avisa en esta pasada van con su aviso: si el correo no sale, no pueden
  // dejar el dispositivo como conocido (la siguiente pasada no avisaría).
  const keyOf = (p: (typeof plan)[number]) => `${p.login.ownerId}\n${p.deviceKey}`
  const alerts = plan.filter((p) => p.decision === 'alert')
  const alerting = new Set(alerts.map(keyOf))
  const quiet = plan.filter((p) => p.decision !== 'alert' && !alerting.has(keyOf(p)))
  if (quiet.length) {
    await deps.record(quiet.map((p) => row(p, false)))
    summary.recorded = quiet.length
  }
  for (const p of alerts) {
    try {
      await deps.send(loginAlertMail(p.login, deps))
    } catch (err) {
      console.error('login-alert', p.login.sessionId, err instanceof Error ? err.message : err)
      summary.failed++
      continue
    }
    const followers = plan.filter((x) => x !== p && x.decision !== 'alert' && keyOf(x) === keyOf(p))
    await deps.record([row(p, true), ...followers.map((x) => row(x, false))])
    summary.emailed++
    summary.recorded += followers.length
  }
  return summary
}
