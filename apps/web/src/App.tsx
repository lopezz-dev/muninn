import { backendLabel } from './lib/muninn'

/** Pantalla provisional: la UI real llega con el sistema de diseño. */
export function App() {
  return (
    <main>
      <h1>Muninn</h1>
      <p>Base lista. Datos: {backendLabel}.</p>
    </main>
  )
}
