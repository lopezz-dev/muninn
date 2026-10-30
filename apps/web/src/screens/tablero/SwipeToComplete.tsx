import { useDndContext } from '@dnd-kit/core'
import { cn, icons } from '@muninn/ui'
import { type ReactNode, useRef, useState } from 'react'

/**
 * Desliza a la izquierda para completar (solo con el dedo). Si hay un arrastre en curso no hace
 * nada: es el mismo dedo, y `dnd-kit` ya se ha llevado el gesto.
 */
export function SwipeToComplete({
  onComplete,
  disabled,
  children,
}: {
  onComplete: () => void
  /** Sin conexión no se completa: la tarjeta no se desliza. */
  disabled?: boolean
  children: ReactNode
}) {
  const { active } = useDndContext()
  const [dx, setDx] = useState(0)
  const start = useRef<{ x: number; y: number } | null>(null)
  const axis = useRef<'x' | 'y' | null>(null)
  const THRESHOLD = 96

  const reset = () => {
    start.current = null
    axis.current = null
    setDx(0)
  }

  return (
    <div className="relative rounded-md">
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-0 flex items-center justify-end gap-1.5 rounded-md bg-success pr-5 text-sm font-semibold text-black/80 transition-opacity',
          dx < 0 ? 'opacity-100' : 'opacity-0',
        )}
      >
        <icons.check size={16} weight="bold" />
        Hecho
      </div>
      <div
        className="relative"
        style={{
          transform: dx ? `translateX(${dx}px)` : undefined,
          transition: start.current
            ? 'none'
            : 'transform 180ms var(--mn-motion-ease-out, ease-out)',
        }}
        onPointerDown={(e) => {
          if (e.pointerType !== 'touch' || active || disabled) return
          start.current = { x: e.clientX, y: e.clientY }
          axis.current = null
        }}
        onPointerMove={(e) => {
          const s = start.current
          if (!s || active) return
          const [mx, my] = [e.clientX - s.x, e.clientY - s.y]
          if (!axis.current) {
            if (Math.abs(mx) > 10 && Math.abs(mx) > Math.abs(my) * 1.5) axis.current = 'x'
            else if (Math.abs(my) > 10) return reset()
            else return
          }
          setDx(Math.max(-160, Math.min(0, mx)))
        }}
        onPointerUp={() => {
          if (axis.current === 'x' && dx <= -THRESHOLD) onComplete()
          reset()
        }}
        onPointerCancel={reset}
      >
        {children}
      </div>
    </div>
  )
}
