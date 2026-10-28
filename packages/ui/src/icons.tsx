import { IconContext } from '@phosphor-icons/react/dist/lib/context'
import type { IconProps } from '@phosphor-icons/react/dist/lib/types'
import type { ComponentType, ReactNode } from 'react'
import {
  Archive,
  ArrowDown,
  ArrowRight,
  ArrowsClockwise,
  ArrowUp,
  ArrowUpRight,
  Bell,
  BookOpen,
  CalendarBlank,
  CaretDown,
  CaretLeft,
  CaretRight,
  Check,
  Clock,
  Devices,
  DotsSixVertical,
  DotsThree,
  DownloadSimple,
  Drop,
  Flag,
  FunnelSimple,
  GitBranch,
  GithubLogo,
  House,
  ImageSquare,
  Info,
  Kanban,
  Key,
  Keyboard,
  LinkSimple,
  MagnifyingGlass,
  Microphone,
  Newspaper,
  Note,
  Palette,
  Paperclip,
  PaperPlaneTilt,
  PencilSimple,
  Plus,
  PushPin,
  Repeat,
  Robot,
  SignOut,
  SlidersHorizontal,
  Sparkle,
  SpeakerHigh,
  SquaresFour,
  Trash,
  User,
  Wallet,
  WarningCircle,
  X,
} from './icons.generated'

/**
 * Iconos de Muninn (Phosphor, con solo los grosores que se usan: ADR-0058) con nombres semánticos. La app importa SIEMPRE desde aquí,
 * nunca de '@phosphor-icons/react' directamente: así cambiar de librería es tocar este fichero.
 */
export const icons = {
  home: House,
  projects: Kanban,
  notes: Note,
  finance: Wallet,
  assistant: Sparkle,
  news: Newspaper,
  github: GithubLogo,
  branch: GitBranch,
  agent: Robot,
  docs: BookOpen,
  settings: SlidersHorizontal,
  more: SquaresFour,
  search: MagnifyingGlass,
  plus: Plus,
  bell: Bell,
  mic: Microphone,
  send: PaperPlaneTilt,
  speaker: SpeakerHigh,
  calendar: CalendarBlank,
  flag: Flag,
  check: Check,
  close: X,
  chevronDown: CaretDown,
  chevronLeft: CaretLeft,
  chevronRight: CaretRight,
  dots: DotsThree,
  grip: DotsSixVertical,
  link: LinkSimple,
  clock: Clock,
  filter: FunnelSimple,
  sync: ArrowsClockwise,
  external: ArrowUpRight,
  move: ArrowRight,
  income: ArrowUp,
  expense: ArrowDown,
  recurring: Repeat,
  user: User,
  pin: PushPin,
  archive: Archive,
  trash: Trash,
  download: DownloadSimple,
  glass: Drop,
  palette: Palette,
  keyboard: Keyboard,
  info: Info,
  warning: WarningCircle,
  image: ImageSquare,
  attach: Paperclip,
  edit: PencilSimple,
  devices: Devices,
  key: Key,
  signOut: SignOut,
} satisfies Record<string, ComponentType<IconProps>>

export type IconName = keyof typeof icons
export type { IconProps }

/** Icono por nombre, útil cuando el icono viene de datos (navegación, módulos). */
export function Icon({ name, ...props }: IconProps & { name: IconName }) {
  const Component = icons[name]
  return <Component aria-hidden={props['aria-label'] ? undefined : true} {...props} />
}

/** Valores por defecto de los iconos: 16 px y trazo regular, como en el diseño. */
export function IconDefaults({ children }: { children: ReactNode }) {
  return (
    <IconContext.Provider value={{ size: 16, weight: 'regular', mirrored: false }}>
      {children}
    </IconContext.Provider>
  )
}
