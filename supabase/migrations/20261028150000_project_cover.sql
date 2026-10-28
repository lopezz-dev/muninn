-- Portada de proyecto aparte del logo (ADR-0056). Solo aditiva: `image_path` pasa a ser el logo (el icono cuadrado) y
-- `cover_path` el banner de la tarjeta. Usa el mismo bucket `project-images` y sus políticas.

alter table public.projects
  add column cover_path text check (cover_path is null or char_length(cover_path) <= 300);
