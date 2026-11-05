import { i18n, NAMESPACES } from '../src/i18n'

// Los tests se escribieron con los textos en español: fijamos el idioma para que no dependa del navegador del entorno
// (jsdom dice `en-US`). Un test de traducciones puede cambiarlo con `i18n.changeLanguage`.
await i18n.changeLanguage('es')
// Los namespaces diferidos, ya cargados en los dos idiomas: así un componente no suspende en mitad de un test.
await i18n.loadLanguages(['en', 'es'])
await i18n.loadNamespaces([...NAMESPACES])
