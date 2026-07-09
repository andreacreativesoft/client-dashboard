-- ============================================================
-- 004 — connected_accounts multi-comptes (global agence / spécifique client)
--
-- client_id devient nullable : NULL = compte « global / agence » (créé par un
-- admin, invisible aux clients via la RLS existante `client_id in
-- get_user_client_ids()`, liable à n'importe quel site). client_id renseigné =
-- compte spécifique à un client.
-- created_by = auteur de la connexion (admin ou utilisateur client).
--
-- Aucune modification de RLS nécessaire : la policy client de connected_accounts
-- filtre déjà sur client_id, ce qui exclut naturellement les comptes globaux.
-- ============================================================

alter table public.connected_accounts
  alter column client_id drop not null;

alter table public.connected_accounts
  add column if not exists created_by uuid references public.profiles(id) on delete set null;

create index if not exists connected_accounts_created_by_idx
  on public.connected_accounts(created_by);
