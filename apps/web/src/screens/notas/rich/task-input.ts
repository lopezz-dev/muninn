import { Extension, InputRule } from '@tiptap/core'

/**
 * `- [ ] ` del tirón: TipTap solo convierte `[ ] ` al principio de un párrafo suelto, y quien escribe Markdown teclea
 * primero `- ` (que ya abre una lista de viñetas). Aquí, `[ ] ` o `[x] ` al principio de un elemento de esa lista la
 * convierte en lista de tareas, marcada o no.
 */
export const TaskFromBullet = Extension.create({
  name: 'taskFromBullet',
  addInputRules() {
    return [
      new InputRule({
        find: /^\[([ xX])?\]\s$/,
        handler: ({ state, range, match, chain }) => {
          const $from = state.doc.resolve(range.from)
          if ($from.depth < 2 || $from.node(-1).type.name !== 'listItem') return null
          if ($from.node(-2).type.name !== 'bulletList') return null
          const checked = (match[1] ?? ' ').toLowerCase() === 'x'
          chain()
            .deleteRange(range)
            .toggleTaskList()
            .updateAttributes('taskItem', { checked })
            .run()
        },
      }),
    ]
  },
})
