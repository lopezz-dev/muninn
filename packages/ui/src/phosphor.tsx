import IconBase from '@phosphor-icons/react/dist/lib/IconBase'
import type { IconProps, IconWeight } from '@phosphor-icons/react/dist/lib/types'
import { createElement, Fragment, forwardRef, type ReactElement } from 'react'

/** Una forma del SVG: etiqueta y atributos tal cual los trae Phosphor (`path`, `circle`, `line`…). */
type Shape = readonly [tag: string, attrs: Record<string, string>]
export type IconData = Partial<Record<IconWeight, readonly Shape[]>>

/** Si piden un grosor que no generamos, se pinta el regular en vez de un SVG vacío. */
class Weights extends Map<IconWeight, ReactElement> {
  override get(weight: IconWeight) {
    return super.get(weight) ?? super.get('regular')
  }
}

/**
 * Icono de Phosphor con solo los grosores generados (`*.generated.ts`, ADR-0058). El paquete trae los seis
 * grosores de cada icono en el mismo módulo y el bundler no puede quitar los que no se usan.
 */
export function phosphorIcon(name: string, data: IconData) {
  const weights = new Weights(
    Object.entries(data).map(([weight, shapes]) => [
      weight as IconWeight,
      createElement(
        Fragment,
        null,
        ...(shapes ?? []).map(([tag, attrs], i) => createElement(tag, { key: i, ...attrs })),
      ),
    ]),
  )
  const Icon = forwardRef<SVGSVGElement, IconProps>((props, ref) => (
    <IconBase ref={ref} {...props} weights={weights} />
  ))
  Icon.displayName = `${name}Icon`
  return Icon
}
