// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const navigate = vi.fn()
vi.mock('@tanstack/react-router', () => ({
  getRouteApi: () => ({ useSearch: () => ({ authorization_id: 'az1' }) }),
  useRouter: () => ({ navigate }),
  Link: ({ children }: { children: React.ReactNode }) => <a href="/">{children}</a>,
}))
vi.mock('../src/lib/muninn', () => ({
  useAuth: () => ({ kind: 'user', account: { id: 'u1' } }),
}))
const resetAuth = vi.fn()
vi.mock('../src/lib/auth', () => ({ resetAuth }))
const notify = { info: vi.fn(), error: vi.fn(), success: vi.fn() }
vi.mock('@muninn/ui', async (orig) => ({ ...(await orig<object>()), notify }))

const details = {
  authorization_id: 'az1',
  redirect_uri: 'https://claude.ai/api/mcp/auth_callback',
  scope: '',
  client: { name: 'Claude' },
  user: { email: 'tu@correo.com' },
}
const consent = {
  getConsentRequest: vi.fn(async () => ({ kind: 'ask', details })),
  consentSecondFactor: vi.fn(async () => 'passed'),
  approveAppWithMfa: vi.fn(async () => true),
  decideConsent: vi.fn(async () => 'https://claude.ai/api/mcp/auth_callback?code=x'),
}
vi.mock('../src/lib/oauth-consent', async (orig) => ({ ...(await orig<object>()), ...consent }))

const { OAuthConsent } = await import('../src/screens/OAuthConsent')

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const allow = () => screen.findByRole('button', { name: 'Permitir acceso' })

describe('OAuthConsent', () => {
  it('con el segundo factor pasado, apunta la aprobación y da acceso sin aviso', async () => {
    render(<OAuthConsent />)
    fireEvent.click(await allow())
    await waitFor(() => expect(consent.decideConsent).toHaveBeenCalledWith('az1', true))
    expect(consent.approveAppWithMfa).toHaveBeenCalledWith('az1', 'u1')
    expect(notify.success).toHaveBeenCalledWith(
      'Claude ya puede usar tu Muninn',
      expect.objectContaining({ description: 'Volviendo a claude.ai…' }),
    )
  })

  it('si la aprobación con el segundo factor no queda apuntada, avisa', async () => {
    consent.approveAppWithMfa.mockResolvedValueOnce(false)
    render(<OAuthConsent />)
    fireEvent.click(await allow())
    await waitFor(() => expect(notify.success).toHaveBeenCalled())
    expect(notify.success).toHaveBeenCalledWith(
      'Claude ya puede usar tu Muninn',
      expect.objectContaining({
        description: expect.stringContaining('quítale el acceso y vuelve a conectarla'),
      }),
    )
  })

  it('si falla al apuntarla, también avisa', async () => {
    vi.spyOn(console, 'warn').mockImplementationOnce(() => {})
    consent.approveAppWithMfa.mockRejectedValueOnce(new Error('red'))
    render(<OAuthConsent />)
    fireEvent.click(await allow())
    await waitFor(() => expect(notify.success).toHaveBeenCalled())
    expect(notify.success.mock.calls[0]?.[1]?.description).toMatch(/quítale el acceso/)
  })

  it('sin segundo factor en la cuenta, no lo apunta ni avisa', async () => {
    consent.consentSecondFactor.mockResolvedValueOnce('none')
    render(<OAuthConsent />)
    fireEvent.click(await allow())
    await waitFor(() => expect(consent.decideConsent).toHaveBeenCalled())
    expect(consent.approveAppWithMfa).not.toHaveBeenCalled()
    expect(notify.success.mock.calls[0]?.[1]?.description).toBe('Volviendo a claude.ai…')
  })

  it('con un factor verificado y la sesión en aal1, pide el código antes de «Permitir acceso»', async () => {
    consent.consentSecondFactor.mockResolvedValueOnce('pending')
    render(<OAuthConsent />)
    fireEvent.click(await screen.findByRole('button', { name: 'Escribir el código' }))
    expect(screen.queryByRole('button', { name: 'Permitir acceso' })).toBeNull()
    expect(resetAuth).toHaveBeenCalled()
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({ to: '/login', search: { redirect: expect.stringMatching(/^\//) } }),
    )
    expect(consent.decideConsent).not.toHaveBeenCalled()
  })
})
