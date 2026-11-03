/**
 * La forma de un diccionario traducido: las mismas claves que el inglés (la fuente), cada una con su texto. Una clave
 * que falta o sobra no compila. Los plurales de i18next (`_one`, `_other`) son claves como las demás.
 */
export type Messages<T> = { [K in keyof T]: T[K] extends string ? string : Messages<T[K]> }
