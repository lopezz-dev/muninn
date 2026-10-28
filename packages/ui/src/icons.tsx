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
  DotsSixVertical,
  DotsThree,
  DownloadSimple,
  Drop,
  Flag,
  FunnelSimple,
  GitBranch,
  GithubLogo,
  House,
  IconContext,
  type IconProps,
  ImageSquare,
  Info,
  Kanban,
  Keyboard,
  LinkSimple,
  MagnifyingGlass,
  Microphone,
  Newspaper,
  Note,
  Palette,
  Paperclip,
  PaperPlaneTilt,
  Plus,
  PushPin,
  Repeat,
  Robot,
  SlidersHorizontal,
  Sparkle,
  SpeakerHigh,
  SquaresFour,
  Trash,
  User,
  Wallet,
  WarningCircle,
  X,
} from '@phosphor-icons/react'
import type { ComponentType, ReactNode } from 'react'

/**
 * Iconos de Muninn (Phosphor) con nombres semánticos. La app importa SIEMPRE desde aquí,
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
