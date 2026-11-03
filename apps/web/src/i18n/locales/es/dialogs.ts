import type { Messages } from '../../types'
import type { dialogs as en } from '../en/dialogs'

/** Textos de `dialogs` en español. Mismas claves que `en/dialogs.ts`: si falta una, no compila. */
export const dialogs: Messages<typeof en> = {
  actions: {
    cancel: 'Cancelar',
  },
  newTask: {
    title: 'Nueva tarea',
    description: 'Se crea al final de la columna que elijas.',
    needsProject: 'Necesitas un proyecto.',
    noProjects: 'Las tareas viven en el tablero de un proyecto. Crea el primero y vuelve aquí.',
    newProject: 'Nuevo proyecto',
    titleField: 'Título',
    titleRequired: 'Ponle un título a la tarea',
    project: 'Proyecto',
    column: 'Columna',
    priority: 'Prioridad',
    due: 'Vence',
    create: 'Crear tarea',
  },
  project: {
    editTitle: 'Editar proyecto',
    newTitle: 'Nuevo proyecto',
    newDescription: 'Empieza con un tablero de cinco columnas que puedes cambiar cuando quieras.',
    images: 'Logo y portada',
    logo: 'Logo',
    cover: 'Portada',
    pickLogo: 'Elegir logo',
    changeLogo: 'Cambiar logo',
    pickCover: 'Elegir portada',
    changeCover: 'Cambiar portada',
    remove: 'Quitar',
    imagesHint:
      'Opcionales. Se reducen en tu dispositivo antes de subirlas. El logo es el icono del proyecto y su color se ofrece como color del proyecto; sin portada, el banner usa ese color.',
    imageFailed: 'No se pudo usar esa imagen',
    imageUploadFailed: 'El proyecto se creó, pero no se pudo subir la imagen',
    name: 'Nombre',
    nameRequired: 'Ponle un nombre al proyecto',
    description: 'Descripción',
    descriptionHint: 'Opcional. Sale en la tarjeta del proyecto y la lee el asistente.',
    descriptionPlaceholder: 'De qué va, para qué es, qué cuenta como terminado…',
    color: 'Color',
    colors: {
      blue: 'Azul',
      violet: 'Violeta',
      teal: 'Verde azulado',
      pink: 'Rosa',
      green: 'Verde',
      amber: 'Ámbar',
      fromLogo: 'Del logo',
      custom: 'Personalizado',
    },
    archive: 'Archivar',
    save: 'Guardar',
    create: 'Crear proyecto',
  },
}
