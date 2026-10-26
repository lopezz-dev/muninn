/**
 * `@muninn/assistant` (ADR-0041): el catálogo único de herramientas (también lo usa el MCP), el bucle de herramientas y
 * los proveedores del modelo (Ollama en local y uno guionizado para tests y demo). Sin dependencias de navegador ni de
 * Node: corre en la app (en diferido), en el MCP y en los tests.
 */
export * from './agent'
export * from './prompt'
export * from './provider'
export * from './providers/ollama'
export * from './providers/scripted'
export * from './tools'
