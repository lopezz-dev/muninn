/** Dentro de un campo o de un diálogo, las teclas sueltas son para escribir. */
export const typingIn = (t: EventTarget | null) =>
  t instanceof HTMLElement &&
  Boolean(t.closest('input, textarea, select, [contenteditable="true"], [role=dialog]'))
