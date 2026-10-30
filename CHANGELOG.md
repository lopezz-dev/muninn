# Changelog

## [0.6.0](https://github.com/lopezz-dev/muninn/compare/v0.5.0...v0.6.0) (2026-10-30)


### Features

* **db:** apps OAuth aprobadas con el segundo factor cuentan como aal2 (ADR-0064) ([7694340](https://github.com/lopezz-dev/muninn/commit/769434047a6c110e4456c1e1314a473eb5303dcf))
* **db:** apps OAuth aprobadas con el segundo factor cuentan como aal2 (ADR-0064) ([e4008e4](https://github.com/lopezz-dev/muninn/commit/e4008e4c6d8395e158d567c1c796a8a0300a735f))


### Bug Fixes

* **db:** la aprobación OAuth con segundo factor vale para una sola sesión (ADR-0066) ([449114a](https://github.com/lopezz-dev/muninn/commit/449114a70a6843f324d61c97943e0143a189c90c))
* **db:** require_mfa en las tablas de avisos push ([5a5da7d](https://github.com/lopezz-dev/muninn/commit/5a5da7d833ac25579e9d4b0146c640418c20d91b))

## [0.5.0](https://github.com/lopezz-dev/muninn/compare/v0.4.0...v0.5.0) (2026-10-29)


### Features

* Ajustes › Cuenta: sesiones, segundo factor (TOTP) y apps con acceso ([57d9b35](https://github.com/lopezz-dev/muninn/commit/57d9b35d9c2ebeeb0ca839954bb9c9ecefa896da))
* **core:** eliminar proyectos archivados y soltar el repo al archivar (ADR-0065) ([75b0a68](https://github.com/lopezz-dev/muninn/commit/75b0a68ff7fd022f01c5329ce583c727e8de72c0))
* **core:** eliminar proyectos archivados y soltar el repo al archivar (ADR-0065) ([c626bc6](https://github.com/lopezz-dev/muninn/commit/c626bc688a7dcfef76af3b0fdbaaacf63c6c7de7))
* **core:** m.push para suscribir, listar y quitar dispositivos y avisos de cobro ([c4f049b](https://github.com/lopezz-dev/muninn/commit/c4f049b16fa2c6c1105ccd14f338d76256ef1af7))
* **core:** ver y cerrar sesiones y dispositivos en Ajustes › Cuenta ([abde8e0](https://github.com/lopezz-dev/muninn/commit/abde8e07e0281fecad509d18410a5d93552f7692))
* **db:** Edge Function push con VAPID para el cron de cobros y el aviso de prueba ([710875e](https://github.com/lopezz-dev/muninn/commit/710875e67a601a132a30232a0792248bc8592365))
* **db:** el servidor exige el segundo factor (ADR-0062) ([aa144ef](https://github.com/lopezz-dev/muninn/commit/aa144ef8bf408412adf011ceb9d952d93712423d))
* **db:** el servidor exige el segundo factor (ADR-0062) ([67244e0](https://github.com/lopezz-dev/muninn/commit/67244e02dd3d192b28eabb1fe22703b432cdefaf))
* **db:** tablas push_subscriptions y push_log con RLS (ADR-0040) ([f08102c](https://github.com/lopezz-dev/muninn/commit/f08102cde9e4e83e0b1136e83562e4587c0078d8))
* **desktop:** GitHub OAuth en escritorio con deep link muninn://auth/callback ([89ba150](https://github.com/lopezz-dev/muninn/commit/89ba150e23371b7446fb098fc29fa6c278580be5))
* **desktop:** GitHub OAuth en escritorio con deep link muninn://auth/callback ([f5d802a](https://github.com/lopezz-dev/muninn/commit/f5d802a585e33b37ac4fdc54c6bc2514ce4fc975))
* **mcp:** crear tareas en lote (create_tasks) y proyecto por nombre sin archivados ([749efef](https://github.com/lopezz-dev/muninn/commit/749efeff1b74917304689c8418376284028f7b63))
* **mcp:** crear tareas en lote con su checklist (create_tasks) ([328f5a8](https://github.com/lopezz-dev/muninn/commit/328f5a8eb210bd436fce35fb288b89518193e68f))
* **web:** Ajustes › Notificaciones con avisos push por dispositivo ([8bbe6eb](https://github.com/lopezz-dev/muninn/commit/8bbe6ebe92f859737e9d4ca0144c6315002ecd87))
* **web:** buscar tareas y notas en ⌘K y acción «Nueva nota» ([4924399](https://github.com/lopezz-dev/muninn/commit/4924399fba65829d1598e984e76532cf286bf453))
* **web:** CAPTCHA con Cloudflare Turnstile en la entrada ([1b13c49](https://github.com/lopezz-dev/muninn/commit/1b13c49aec2f7b1643007ad9f048335e0ddda389))
* **web:** CAPTCHA con Cloudflare Turnstile en la entrada ([b7fe9a1](https://github.com/lopezz-dev/muninn/commit/b7fe9a1c76f84e535fd6f444d4604a82d7c04e1c))
* **web:** el segundo factor se activa y desactiva en su diálogo (ADR-0063) ([e567caf](https://github.com/lopezz-dev/muninn/commit/e567caf152253bbfdfa2099efc7829ae3e81cd8c))
* **web:** el segundo factor se activa y desactiva en su diálogo (ADR-0063) ([84eb083](https://github.com/lopezz-dev/muninn/commit/84eb083fab60c920466ccabc7f10c62da1dafe48))
* **web:** PWA con Web Push: suscripción por dispositivo, función push y aviso antes del cobro ([f7b49fc](https://github.com/lopezz-dev/muninn/commit/f7b49fcaa8f69c263ceac6f920b0f6f0864e15b1))
* **web:** segundo factor (MFA) con app de códigos TOTP ([742d3b1](https://github.com/lopezz-dev/muninn/commit/742d3b13ab3c2f9c5a3bd4300adc0ebe0054b4c7))
* **web:** ver y quitar los permisos OAuth dados a otras apps ([386e95c](https://github.com/lopezz-dev/muninn/commit/386e95c0b0538a52f765e1478c7d71d2eaaa3e26))


### Bug Fixes

* **core:** distinguir la app de escritorio y las apps conectadas en Sesiones ([7687029](https://github.com/lopezz-dev/muninn/commit/768702940d80b074a384efe61d70279228b56131))
* **core:** distinguir la app de escritorio y las apps conectadas en Sesiones ([2ca5e1d](https://github.com/lopezz-dev/muninn/commit/2ca5e1d1ca7d56e7c78a44b9841cb1976159ebe9))
* **core:** solo servicios de push conocidos en las suscripciones (SSRF) ([56fcf4e](https://github.com/lopezz-dev/muninn/commit/56fcf4e6005450fd9f7a247644965cadf71743fb))
* **desktop:** abrir los enlaces externos con tauri-plugin-opener ([b7c0844](https://github.com/lopezz-dev/muninn/commit/b7c08448213e511f354dee54a1db8b4a98c9284c))
* **desktop:** abrir los enlaces externos con tauri-plugin-opener ([295344a](https://github.com/lopezz-dev/muninn/commit/295344a861457ce4b249f76c3b2a0b6b7961167a))
* **desktop:** solo PKCE en la vuelta de GitHub y solo con un login empezado aquí ([43fc509](https://github.com/lopezz-dev/muninn/commit/43fc509dba6eec784e17d3d8f499b5962bb2c00e))
* **mcp:** el conector de claude.ai se presenta con el logo de Muninn ([ded3077](https://github.com/lopezz-dev/muninn/commit/ded30770ac382b7c536529bd33786f94644f5f86))
* **mcp:** el proyecto por nombre prefiere el activo al archivado ([d78abb7](https://github.com/lopezz-dev/muninn/commit/d78abb7302a3b2bd34072c0b2fc9f5ffcab26dd8))
* **web:** la barra de pestañas no se corta por abajo en la app del iPhone ([ff65506](https://github.com/lopezz-dev/muninn/commit/ff6550663f5291c271256eb1bf7980f822a68b73))
* **web:** la barra de pestañas no se corta por abajo en la app del iPhone ([65a1add](https://github.com/lopezz-dev/muninn/commit/65a1adde1c49e3eb2c2c4b1121becfaa95b41936))


### Performance Improvements

* **ui:** iconos de Phosphor con solo los grosores que se usan ([78bff27](https://github.com/lopezz-dev/muninn/commit/78bff27f6144e9d0573549ed51b8326d97f19845))

## [0.4.0](https://github.com/lopezz-dev/muninn/compare/v0.3.0...v0.4.0) (2026-10-28)


### Features

* **web:** logo y portada de proyecto por separado, con el color del logo (ADR-0056) ([e7ec2fc](https://github.com/lopezz-dev/muninn/commit/e7ec2fc5b6da1653e0cda2e1c07bac6dcb1a7dc2))
* **web:** Proyectos en tres tamaños, editar proyecto e imagen de proyecto (ADR-0055) ([adb73ae](https://github.com/lopezz-dev/muninn/commit/adb73aecc3024cf06cf1fc36bde88da8326c8baa))
* **web:** shell en tres tamaños e Inicio responsive (ADR-0054) ([338c8b3](https://github.com/lopezz-dev/muninn/commit/338c8b38a740e60ea7d6374a1a57c0b6b398a8ef))

## [0.3.0](https://github.com/lopezz-dev/muninn/compare/v0.2.1...v0.3.0) (2026-10-28)


### Features

* **web:** rediseño de Ajustes con grupos, buscador y restablecer ([bad1ba4](https://github.com/lopezz-dev/muninn/commit/bad1ba454550a33baa83f39fa577bc9c2d24eedf))
* **web:** rediseño de Documentación con portada, grupos e iconos ([f8bd09b](https://github.com/lopezz-dev/muninn/commit/f8bd09bb15ac8642aebd190f09d01bd6cbea83dc))

## [0.2.1](https://github.com/lopezz-dev/muninn/compare/v0.2.0...v0.2.1) (2026-10-28)


### Bug Fixes

* **ci:** compila la app de escritorio con las variables de Supabase ([e208ab4](https://github.com/lopezz-dev/muninn/commit/e208ab431e6e3a023949424b0f98cb6bc32e6007))
* **ci:** compila la app de escritorio con las variables de Supabase ([b274733](https://github.com/lopezz-dev/muninn/commit/b274733d048857d93c452553768034caa3ff09ad))

## [0.2.0](https://github.com/lopezz-dev/muninn/compare/v0.1.0...v0.2.0) (2026-10-28)


### Features

* **apps:** esqueleto de la PWA y de la app de escritorio Tauri 2 ([5b6d797](https://github.com/lopezz-dev/muninn/commit/5b6d7978e9e6c5862bb332b801c63d7b0289a8ce))
* base de Muninn (monorepo, esquema, core, MCP, CI/CD) ([c787fa9](https://github.com/lopezz-dev/muninn/commit/c787fa9d9b765ea943f3dce1674072402b8d01e3))
* **core:** ajustes de usuario (user_settings) en los stores y en el servicio ([811d780](https://github.com/lopezz-dev/muninn/commit/811d780261477f526cff89e88c59e07f83af62db))
* **core:** API de dominio con stores de Supabase, fichero y memoria ([250243b](https://github.com/lopezz-dev/muninn/commit/250243b37884fc12613c68152b8e0935b702adc6))
* **core:** cerebro del asistente con catálogo único de herramientas ([28ab205](https://github.com/lopezz-dev/muninn/commit/28ab20509e815b68c711c7908c68bcfe81306e9e))
* **core:** cerebro del asistente con catálogo único de herramientas (F4·A) ([e9d130e](https://github.com/lopezz-dev/muninn/commit/e9d130e04e16ecdd85ced76b81000e39440bc687))
* **core:** columna «Para el agente» (ADR-0032) ([791398f](https://github.com/lopezz-dev/muninn/commit/791398f412b72ab462ea0ad9b3b965a5d27f4343))
* **core:** columna «Para el agente» (ADR-0032) ([0874261](https://github.com/lopezz-dev/muninn/commit/087426176ec69b2b8427aa763ec6313ec20eaf3f))
* **core:** filtrar la actividad por acciones (AGENT_ACTIONS) ([2978e35](https://github.com/lopezz-dev/muninn/commit/2978e3551095e3ec079c039acddcb43b974fbd26))
* **core:** modelo de datos de Finanzas (ADR-0037) ([5c5acbb](https://github.com/lopezz-dev/muninn/commit/5c5acbb85322d4a1e91052f70a79bf2e23f6e510))
* **core:** modelo de datos de Finanzas con saldo derivado (ADR-0037) ([f6f613f](https://github.com/lopezz-dev/muninn/commit/f6f613f3bf87143fe22d1052741c53e672164668))
* **core:** Noticias con RSS, descarga en servidor y resumen diario en local (F4·C) ([#37](https://github.com/lopezz-dev/muninn/issues/37)) ([b19bb72](https://github.com/lopezz-dev/muninn/commit/b19bb72b35acf40e058fa0e60064e73cf44dc721))
* **core:** panel mensual de finanzas (ADR-0039) ([b275c32](https://github.com/lopezz-dev/muninn/commit/b275c32827f43e28297e947288729840cff317e8))
* **core:** panel mensual de finanzas calculado en el core (ADR-0039) ([f69ad1c](https://github.com/lopezz-dev/muninn/commit/f69ad1c7adf82ff00b6c3f768c3ae0a5f7ae6cda))
* **core:** restaurar notas, vínculo coherente con la tarea y actividad sin ruido ([153f9e2](https://github.com/lopezz-dev/muninn/commit/153f9e2411a24b8f4de84c7ccebed65abfd54caa))
* **core:** restaurar tareas, progreso de subtareas, actividad por entidad y overview ampliado ([40dd5c6](https://github.com/lopezz-dev/muninn/commit/40dd5c671a847c27d08bcd5604ec6560873eeb30))
* **core:** sincronización de issues de GitHub con tareas ([e1db326](https://github.com/lopezz-dev/muninn/commit/e1db3260b3149d7d9b913a02e761730cc405e9a2))
* **core:** sincronización de issues de GitHub con tareas ([951dc65](https://github.com/lopezz-dev/muninn/commit/951dc65822415b45d14c372501299c9da4f36439))
* **core:** suscripciones recurrentes con aviso (ADR-0038) ([6f4a92d](https://github.com/lopezz-dev/muninn/commit/6f4a92d52307d5d48d76cfbe1a470732228a9699))
* **core:** suscripciones recurrentes con aviso antes del cobro (ADR-0038) ([09fdab9](https://github.com/lopezz-dev/muninn/commit/09fdab91335862a2acf256c15abdfdcdf1e691ec))
* **db:** esquema inicial con proyectos, tablero, tareas, notas, actividad y RLS ([bf76e90](https://github.com/lopezz-dev/muninn/commit/bf76e90ada6802feb172281c0f4d8db5360f42c8))
* **db:** plantillas de correo de acceso y registro con la marca de Muninn ([232eb3c](https://github.com/lopezz-dev/muninn/commit/232eb3c4f117ad4e7534e732419d7a8ffec5f740))
* **db:** search_path fijo en las funciones, índices de FK y plantilla de correo con el código ([b6033fe](https://github.com/lopezz-dev/muninn/commit/b6033feecd28415f37c6ad533b76e6300c739eae))
* **desktop:** actualizaciones firmadas y repo público con MIT ([#48](https://github.com/lopezz-dev/muninn/issues/48)) ([7a9ae5b](https://github.com/lopezz-dev/muninn/commit/7a9ae5b34ee3fe5626443acf0db679e72394ec24))
* **desktop:** iconos de escritorio con el logo de la app ([#46](https://github.com/lopezz-dev/muninn/issues/46)) ([96c399e](https://github.com/lopezz-dev/muninn/commit/96c399ee111bcd6c62a0b8489384f4a55791faeb))
* login con Supabase Auth y sesión en la UI ([67439ed](https://github.com/lopezz-dev/muninn/commit/67439ed236310fa5a2117ae59069401239249c00))
* **mcp:** MCP remoto por HTTP con el token del usuario ([23cec7e](https://github.com/lopezz-dev/muninn/commit/23cec7efce6f95614d76f07cde5e1c88b162b527))
* **mcp:** MCP remoto por HTTP con el token del usuario ([8690b09](https://github.com/lopezz-dev/muninn/commit/8690b0937cd8feb6424d297e86ec4d97d9f61985))
* **mcp:** servidor MCP para Claude, Codex y modelos locales ([7da4314](https://github.com/lopezz-dev/muninn/commit/7da43142ee3b2b8c65ca5de74efe3dd5c31f0fad))
* **ui:** AmountField, campo de importe que bloquea letras y trabaja en céntimos ([36ddf02](https://github.com/lopezz-dev/muninn/commit/36ddf02a248f7821b7c3daacdb876baaf0b3f464))
* **ui:** Avatar con foto e iniciales de reserva ([7b95d7e](https://github.com/lopezz-dev/muninn/commit/7b95d7e02035d0ed3e9868de245bec138ef2e184))
* **ui:** componentes base (Radix + tokens de Muninn) ([f3e278e](https://github.com/lopezz-dev/muninn/commit/f3e278ea32039d5ec50368cf651b303acaa0a31b))
* **ui:** componentes base sobre Radix (botones, campos, overlays, menú, tooltip) ([913e0ba](https://github.com/lopezz-dev/muninn/commit/913e0bae10dbefb01b751644ddbc7d8e6fd14205))
* **ui:** diálogo bare/lg, un módulo por primitiva de Radix y Kbd sin saltos ([e70c0d0](https://github.com/lopezz-dev/muninn/commit/e70c0d07e2dca23d0a5a3f205e72bfe90f7fc65f))
* **ui:** icono animado en las notificaciones que resalta la acción realizada ([bd8d2d8](https://github.com/lopezz-dev/muninn/commit/bd8d2d8bfe26e721b3a8055ab54fb98047ac61db))
* **ui:** icono de asa y submenús en el menú ([77f1f38](https://github.com/lopezz-dev/muninn/commit/77f1f38f389895d85a3b4d1ce418772c1ff86f40))
* **ui:** notificaciones en píldora (notify + Toaster) y copyText ([4e0f4f4](https://github.com/lopezz-dev/muninn/commit/4e0f4f481d64abe654b56f7949e385a48901803b))
* **ui:** tokens de diseño, Tailwind v4, Phosphor y modo cristal ([129c6cb](https://github.com/lopezz-dev/muninn/commit/129c6cbdac0191b3cb64002ae3a1968a0e2af0cb))
* **ui:** tokens de diseño, tema Tailwind v4, iconos Phosphor y modo cristal ([769ef81](https://github.com/lopezz-dev/muninn/commit/769ef8140ccffee3fd5220862865d399403e5edf))
* **web:** comprobar el acceso del token al elegir un repo público ([4181a29](https://github.com/lopezz-dev/muninn/commit/4181a291d7be8b65e0ff5b160d6c0fe054846ae3))
* **web:** descripción de tarea en Markdown ([d906637](https://github.com/lopezz-dev/muninn/commit/d9066373879a24f304749eca2596f4b4f4bd93a2))
* **web:** descripción de tarea en Markdown ([d35f8e9](https://github.com/lopezz-dev/muninn/commit/d35f8e99fe77ac4ba805101e3249f826a355096c))
* **web:** estructura de la app — router, barra lateral, dock con menisco y ⌘K ([d0a30d4](https://github.com/lopezz-dev/muninn/commit/d0a30d414dbe6e2a72f52f2b4f677e128c716c3f))
* **web:** estructura de la app con router, barra lateral, dock con menisco y ⌘K ([2b57026](https://github.com/lopezz-dev/muninn/commit/2b570267d2bb9da9c304b945fc18221b44e7fc7a))
* **web:** favicon e iconos con el logo de la app y pasada de SEO ([#45](https://github.com/lopezz-dev/muninn/issues/45)) ([92ea12d](https://github.com/lopezz-dev/muninn/commit/92ea12d9ebaf98ebeb80ed8c342ed315963b6a11))
* **web:** feedback en todas las acciones de la galería (copiar, mover, crear, archivar) con Deshacer ([6c61769](https://github.com/lopezz-dev/muninn/commit/6c61769e62fed208316ee6b74f41ba62c5034582))
* **web:** filtros del tablero (texto, prioridad, etiquetas, origen y vencimiento) ([806776a](https://github.com/lopezz-dev/muninn/commit/806776a3c8ec0aa6f84c29267f553e1168e48784))
* **web:** filtros del tablero (texto, prioridad, etiquetas, origen y vencimiento) ([2074657](https://github.com/lopezz-dev/muninn/commit/2074657d8a323aa3d5a65355b24628cb27eca663))
* **web:** galería de componentes en la página de Fundamentos ([d9e7aa1](https://github.com/lopezz-dev/muninn/commit/d9e7aa1487361f5131a6c1eef373ba335178a55b))
* **web:** iconos de acción en las notificaciones y demo de gestos en la galería ([d8b77bc](https://github.com/lopezz-dev/muninn/commit/d8b77bcc15c6c87ad255d619866b4950d8cb3073))
* **web:** informe de la mañana generado en local (F4·D) ([#38](https://github.com/lopezz-dev/muninn/issues/38)) ([9b57fca](https://github.com/lopezz-dev/muninn/commit/9b57fca9d27800a2c9f596dea864132adfcda511))
* **web:** Inicio, tablero Kanban con drag & drop y detalle de tarea ([9e31a1f](https://github.com/lopezz-dev/muninn/commit/9e31a1f9d560dc413ee6175578391e7e61a1acee))
* **web:** Inicio, tablero Kanban con drag & drop y detalle de tarea ([50b341d](https://github.com/lopezz-dev/muninn/commit/50b341d569c546dcf771fc3189d51914b74592c1))
* **web:** login con código por correo y GitHub, sesión en el router, cerrar sesión y apariencia en la cuenta ([58c130c](https://github.com/lopezz-dev/muninn/commit/58c130c2753430c8864f74f631e8c8d8dfb8c139))
* **web:** módulos activables en Ajustes que ocultan menú, dock y buscador ([e0e5fb8](https://github.com/lopezz-dev/muninn/commit/e0e5fb8340aac6a390ce5c7ada8f66e98a46c0be))
* **web:** módulos activables en Ajustes que ocultan menú, dock y buscador ([f61fe05](https://github.com/lopezz-dev/muninn/commit/f61fe05d3cf519f953456319f2c5fadc60af5d33))
* **web:** Notas con editor Markdown, búsqueda, fijadas y notas en el detalle de tarea ([59f4991](https://github.com/lopezz-dev/muninn/commit/59f4991941b9d85913d15d595028b29b339a79d4))
* **web:** Notas con editor Markdown, búsqueda, fijadas y vínculos ([67c7a06](https://github.com/lopezz-dev/muninn/commit/67c7a0680958f5b134b99ed135d231e04a7f40d6))
* **web:** pantalla Asistente con streaming, herramientas y «Deshacer» (F4·B) ([b3d2850](https://github.com/lopezz-dev/muninn/commit/b3d2850eb17421e8bf92d749e0fe91eeb8b361a8))
* **web:** pantalla de autorización OAuth para el MCP remoto ([727b47b](https://github.com/lopezz-dev/muninn/commit/727b47be487e66b58e5e66b6108780d588414b6c))
* **web:** pantalla de autorización OAuth para el MCP remoto (ADR-0036) ([938e4c3](https://github.com/lopezz-dev/muninn/commit/938e4c372e0bf33efc9b9bc4c3d435f3a902d79e))
* **web:** pantalla Finanzas ([9423936](https://github.com/lopezz-dev/muninn/commit/9423936681aa1d49b699e22cdd5be3df866b76a7))
* **web:** pantalla Finanzas con cuentas, movimientos y categorías ([3d1280d](https://github.com/lopezz-dev/muninn/commit/3d1280d15c6413e0dc4cfe1805f39ab41091db71))
* **web:** pantalla GitHub (repos, «Sincronizar ahora» y agente) ([fbc1b54](https://github.com/lopezz-dev/muninn/commit/fbc1b549a5a35fdb8541a139e10abf720103460a))
* **web:** pantalla GitHub con repos, «Sincronizar ahora» y el agente ([9292e24](https://github.com/lopezz-dev/muninn/commit/9292e24c7594178a79b5b4c875af5bc19f625876))
* **web:** pasada de diseño: pantallas a medida, fechas, finanzas, móvil, noticias y asistente ([#49](https://github.com/lopezz-dev/muninn/issues/49)) ([17a3afb](https://github.com/lopezz-dev/muninn/commit/17a3afba5b50d5d75b18abcdfbcd9a1bf64b199c))
* **web:** sección Documentación con las guías de docs/user ([a5da72a](https://github.com/lopezz-dev/muninn/commit/a5da72a8fd99e90454755e400ab1d9d09197b21b))
* **web:** sección Documentación con las guías de docs/user ([8cb172f](https://github.com/lopezz-dev/muninn/commit/8cb172f43b2b21ff72bc465617588a2c2cc17799))
* **web:** selector de repos de GitHub en Ajustes › Integraciones ([d82295e](https://github.com/lopezz-dev/muninn/commit/d82295e20f1e8a2958a16afc147003675420d61d))
* **web:** selector de repos de GitHub en Ajustes › Integraciones ([7820d30](https://github.com/lopezz-dev/muninn/commit/7820d30b66e557a0f9bd0c84d55d933ebed29501))
* **web:** sincronización en tiempo real entre dispositivos y caché de lectura sin conexión ([9027c99](https://github.com/lopezz-dev/muninn/commit/9027c99cfae18a08fa3e8c3310b4a3a9be84364a))
* **web:** Tailwind v4 con el tema de Muninn y página de Fundamentos en vivo ([48a3a0a](https://github.com/lopezz-dev/muninn/commit/48a3a0a11fe65317237a4adc5c8638f9d15a803b))
* **web:** tiempo real entre dispositivos y caché de lectura sin conexión ([ad7d8c0](https://github.com/lopezz-dev/muninn/commit/ad7d8c09df240ef1216b059a87ce2900e9a18663))
* **web:** vista Lista del tablero ([688431c](https://github.com/lopezz-dev/muninn/commit/688431c3957248f80604130513de155c6e50fb85))
* **web:** vista Lista del tablero ([62345d1](https://github.com/lopezz-dev/muninn/commit/62345d1a360e3ac51154594af84bbc3309baaa4b))


### Bug Fixes

* **ci:** Biome formatea tauri.conf.json como lo escribe release-please ([94385a2](https://github.com/lopezz-dev/muninn/commit/94385a2238e6a450aaddc544fb5821ae34c4add2))
* **ci:** Biome formatea tauri.conf.json como lo escribe release-please ([f8bcc1a](https://github.com/lopezz-dev/muninn/commit/f8bcc1a2fcc35ec64911dd2aa6236fcd1d8ceaed))
* **ci:** cerrar el PR del agente si se sacó la tarea con la ejecución en marcha ([c268257](https://github.com/lopezz-dev/muninn/commit/c26825723a6cb15ce79e74739faf50db9285220d))
* **ci:** diagnóstico y cancelación del agente, y pruebas reales ([f1e2255](https://github.com/lopezz-dev/muninn/commit/f1e22552522ca0c15c25a063fa6f13cfc72898dd))
* **ci:** mostrar el error de Claude si falla el agente ([e74c9c4](https://github.com/lopezz-dev/muninn/commit/e74c9c42f8cb4baf986158ba5dac9ec9abee090a))
* **core:** funciones news (con cron) y mcp desplegadas, y error claro para dominios que no existen ([dade490](https://github.com/lopezz-dev/muninn/commit/dade49028fe207bb89b95df1f20a7236956f2108))
* **core:** Noticias dice «No encuentro …» cuando el dominio no existe ([46b5bfa](https://github.com/lopezz-dev/muninn/commit/46b5bfaf7cdcc91f594fa9cb684bcc0bec91d026))
* **core:** Noticias no descarga sin DNS y filtra IPv4 dentro de IPv6 (SSRF) ([#40](https://github.com/lopezz-dev/muninn/issues/40)) ([a4434e4](https://github.com/lopezz-dev/muninn/commit/a4434e4d8943ef6de8907d1b22c502fb2a9dd024))
* **db:** fecha de la migración de la columna del agente ([e548ffe](https://github.com/lopezz-dev/muninn/commit/e548ffefe928f3d118e3ca28959471b1321c51cb))
* **ui:** iniciales del Avatar a partir de la parte local del correo ([81d0315](https://github.com/lopezz-dev/muninn/commit/81d031526556a3341b318cb8ae0f5b55cf1f8106))
* **ui:** rem real de 16px, interruptor centrado y diálogo en píxeles enteros ([5169ab3](https://github.com/lopezz-dev/muninn/commit/5169ab3425f7514d64e80a34832ecfe566f0ef1a))
* **web:** alineación del formulario y campo de importe real en la galería ([996626b](https://github.com/lopezz-dev/muninn/commit/996626b534952824d37678f1fe04f7af9b9d0cbd))
* **web:** campos de texto de 16 px en pantallas táctiles para que iOS no haga zoom ([edb69ca](https://github.com/lopezz-dev/muninn/commit/edb69ca255058b586ee2f1faa386ccdd787fb8fd))
* **web:** cuatro fallos de las pruebas del paso 3 ([af484dc](https://github.com/lopezz-dev/muninn/commit/af484dc3b141a01c1ec17717af72f4ee75569828))
* **web:** desconectar la apariencia de la cuenta al cerrar sesión ([1cf3ee9](https://github.com/lopezz-dev/muninn/commit/1cf3ee95ba9db4dfc7f0f2721856a99c8796cb0e))
* **web:** el enlace de un aviso push solo abre páginas de Muninn ([133a674](https://github.com/lopezz-dev/muninn/commit/133a674c0fe494531012a6010db19fb07ca163ef))
* **web:** la columna del agente no ofrece «Añadir tarea» ([df2b1b3](https://github.com/lopezz-dev/muninn/commit/df2b1b352d608f7665cd400cf456e4835b15b3ff))
* **web:** la vista Lista muestra el número de issue en la insignia de GitHub ([8ff99ab](https://github.com/lopezz-dev/muninn/commit/8ff99abdda33db46bc51a49426fa99a3db862f2f))
* **web:** número de issue en la insignia de la vista Lista ([97f61e7](https://github.com/lopezz-dev/muninn/commit/97f61e798e61a4aba9f3ac262454713a54e11684))
* **web:** resultados del paso 3 de la fase final y sus cuatro arreglos ([e17cfec](https://github.com/lopezz-dev/muninn/commit/e17cfec3f83e1f47071b65710d3cd9236d218dc0))
