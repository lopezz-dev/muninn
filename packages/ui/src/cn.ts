import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * tailwind-merge con los tokens de Muninn. Sin esto, `shadow-drag` o `text-2xs` no se
 * reconocen como sombra/tamaño y dos clases en conflicto podrían convivir.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      shadow: ['popover', 'drag', 'panel'],
      text: ['2xs', 'md'],
    },
  },
})

/** Une clases (condicionales incluidas) y resuelve conflictos de Tailwind: la última gana. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
