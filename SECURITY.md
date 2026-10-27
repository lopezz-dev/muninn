# Política de seguridad

Muninn guarda información personal: tareas, notas y finanzas (cuentas, movimientos, suscripciones). Quien la usa confía en que
nadie más pueda leerla. Nos tomamos en serio cualquier fallo que lo ponga en duda.

## Versiones con soporte

Solo la última versión publicada en [Releases](https://github.com/lopezz-dev/muninn/releases) y la web publicada reciben arreglos
de seguridad.

## Avisar de una vulnerabilidad

**No abras una issue pública.** Escribe a `contact@shion.es` (o usa *Report a vulnerability* en la pestaña **Security** del
repositorio) con:

1. Qué has encontrado y qué supones que puede hacer un atacante.
2. Cómo reproducirlo, mejor con un caso mínimo.
3. Versión, plataforma (web, escritorio, móvil, MCP) y navegador si aplica.
4. Tu valoración del impacto (leer datos de otra persona, modificarlos, ejecutar código…).

Intentamos contestar en **72 horas** y arreglar o mitigar los fallos graves en **30 días**. Te citaremos en las notas de la
versión salvo que prefieras que no.

## Qué protege los datos

El código es público: la seguridad no depende de que nadie lo vea.

- **Cada fila tiene dueño.** Todas las tablas llevan `owner_id` y Row Level Security en Postgres (Supabase): la base de datos solo
  devuelve o modifica filas de la persona con sesión iniciada ([ADR-0004](docs/adr/0004-multiusuario-con-rls.md)). Es el perímetro real.
- **Sin claves de servidor en el cliente.** La web y la app de escritorio solo llevan la dirección del proyecto y la clave
  *publicable* de Supabase, que por sí sola no da acceso a nada. La clave de servicio (que se salta RLS) solo vive como secreto
  en las Edge Functions y, si usas el MCP local con Supabase, en la configuración de tu cliente de IA, en tu ordenador.
- **Sesión sin contraseñas.** Se entra con un código de un solo uso por correo, o con GitHub (OAuth).
- **El MCP no borra.** El servidor MCP no expone borrados definitivos ([ADR-0009](docs/adr/0009-mcp-stdio-sin-borrados.md)), y el
  remoto exige autorización OAuth de la propia cuenta.
- **El asistente de la app es local.** Su modelo corre en tu ordenador (Ollama): las preguntas y los datos que lee no salen a
  terceros. Si conectas Muninn a Claude u otro asistente por MCP, lo que lea viaja a ese servicio.
- **Actualizaciones firmadas.** La app de escritorio solo instala versiones firmadas con la clave del proyecto
  ([ADR-0047](docs/adr/0047-actualizaciones-de-escritorio-firmadas.md)).

## Limitaciones conocidas

- **No hay cifrado de extremo a extremo.** Los datos van cifrados en tránsito (HTTPS) y Supabase cifra el disco, pero quien
  administra el proyecto de Supabase podría leerlos. Cifrar campo a campo con una clave solo tuya no está implementado.
- **Caché sin conexión.** Para funcionar sin red, la app guarda una copia de lectura en el almacenamiento del navegador o de la app
  ([ADR-0029](docs/adr/0029-tiempo-real-y-cache-sin-conexion.md)). Cualquiera con acceso a tu sesión del equipo puede leerla.
- **Instaladores sin firma de sistema.** Los instaladores de Windows y macOS no llevan certificado de Microsoft ni (de momento) de
  Apple: el sistema avisará la primera vez. La firma del actualizador es otra cosa y sí está.
