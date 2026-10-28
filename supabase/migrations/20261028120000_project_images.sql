-- Imagen de proyecto (ADR-0055). Solo aditiva: una columna en `projects` y un bucket privado de Storage.
-- La app reduce la imagen en el navegador y la sube a `project-images/<owner_id>/<project_id>/<uuid>.<ext>`; la fila
-- guarda esa ruta. Se lee con URL firmadas: el bucket no es público.

alter table public.projects
  add column image_path text check (image_path is null or char_length(image_path) <= 300);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('project-images', 'project-images', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Cada usuario solo ve y escribe en su carpeta (la primera parte de la ruta es su id). Sin política de borrado: la
-- app no borra imágenes (así «Deshacer» puede volver a una anterior).
create policy "project_images_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'project-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "project_images_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'project-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
