import { cn } from '@muninn/ui'
import type { ReactNode } from 'react'

/**
 * Rama de un árbol, como las conversaciones anidadas: una línea baja desde el padre y cada hijo se une a ella
 * con su propia curva. La línea sale del borde izquierdo de la lista: colócala con `className` (`ml-…`) bajo
 * el icono o el texto del padre.
 */
export function TreeList({ className, children }: { className?: string; children: ReactNode }) {
  return <ul className={cn('flex flex-col', className)}>{children}</ul>
}

/**
 * Un hijo de la rama. `::before` es la curva hasta su fila; `::after`, la línea que sigue hacia el siguiente
 * (el último no la lleva). La curva va en acento si dentro hay un enlace con `aria-current` (la guía abierta o
 * el apartado que se lee).
 */
export function TreeItem({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <li
      className={cn(
        'relative pl-4',
        "before:pointer-events-none before:absolute before:top-0 before:left-0 before:z-[1] before:h-1/2 before:w-3 before:rounded-bl-xl before:border-b before:border-l before:border-border-strong before:content-['']",
        "after:pointer-events-none after:absolute after:top-0 after:bottom-0 after:left-0 after:border-l after:border-border-strong after:content-[''] last:after:hidden",
        'has-[[aria-current]]:before:border-accent',
        className,
      )}
    >
      {children}
    </li>
  )
}
