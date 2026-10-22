-- Actor del asistente de la app (ADR-0041): lo que hace el asistente local queda en la actividad como
-- `assistant`, distinto de un cliente externo por MCP (`mcp`). Aditiva: solo añade un valor al enum.
alter type public.actor_kind add value if not exists 'assistant';
