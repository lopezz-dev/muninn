import { cn } from '@muninn/ui'

/** Marca provisional (el logo definitivo está en el backlog). Sigue al color de acento. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true" className={cn(className)}>
      <rect width="26" height="26" rx="5" className="fill-accent" />
      <path d="M6 17.5 11.5 8.5l8 1.6-3.6 2.6 3.6 4.8z" className="fill-accent-fg" />
      <circle cx="13.6" cy="11.4" r="1.3" className="fill-accent" />
    </svg>
  )
}
