-- ============================================================
-- 003 — Storage : bucket des avatars
--
-- Bucket public `avatars` + policies sur storage.objects. Sans ça, l'upload
-- de photo de profil (réglages) échoue (« Bucket not found ») sur un projet neuf.
-- storage.objects a déjà la RLS activée par Supabase.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Lecture publique (le bucket est public ; sert les URLs d'avatar).
create policy "Avatars are publicly readable" on storage.objects
  for select using (bucket_id = 'avatars');

-- Les utilisateurs connectés gèrent les fichiers du bucket avatars.
create policy "Authenticated can upload avatars" on storage.objects
  for insert to authenticated with check (bucket_id = 'avatars');
create policy "Authenticated can update avatars" on storage.objects
  for update to authenticated using (bucket_id = 'avatars');
create policy "Authenticated can delete avatars" on storage.objects
  for delete to authenticated using (bucket_id = 'avatars');
