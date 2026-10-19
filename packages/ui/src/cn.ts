import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * tailwind-merge con los tokens de Muninn. Sin esto, `rounded-dock` o `shadow-drag` no se
 * reconocen como radio/sombra y dos clases en conflicto podrían convivir.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      radius: ['dock'],
      shadow: ['popover', 'drag', 'panel'],
      text: ['2xs', 'md'],
    },
  },
})

/** Une clases (condicionales incluidas) y resuelve conflictos de Tailwind: la última gana. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
