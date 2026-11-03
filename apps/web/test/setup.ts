import { i18n } from '../src/i18n'

// Los tests se escribieron con los textos en español: fijamos el idioma para que no dependa del navegador del entorno
// (jsdom dice `en-US`). Un test de traducciones puede cambiarlo con `i18n.changeLanguage`.
await i18n.changeLanguage('es')
