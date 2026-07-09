-- ─────────────────────────────────────────────────────────────────────────
-- Dev local UNIQUEMENT — rejoué automatiquement à chaque `supabase db reset`.
-- N'est PAS exécuté sur le cloud (`db push`), donc rien ici n'affecte la prod.
--
-- Pourquoi : les images Supabase CLI récentes durcissent les *default
-- privileges* du rôle `postgres`. Les tables créées par les migrations
-- n'accordent alors que TRUNCATE/REFERENCES/TRIGGER aux rôles d'API
-- (anon / authenticated / service_role), sans le DML. Sur le cloud ces rôles
-- reçoivent GRANT ALL automatiquement, d'où l'absence de GRANT dans les
-- migrations. En local, on rétablit ici le modèle « grant large + RLS » :
-- la RLS (active sur chaque table) reste la barrière de sécurité réelle.
-- ─────────────────────────────────────────────────────────────────────────

grant select, insert, update, delete on all tables in schema public
    to anon, authenticated, service_role;

grant usage, select on all sequences in schema public
    to anon, authenticated, service_role;

-- Couvre aussi les éventuelles tables créées après ce script.
alter default privileges in schema public
    grant select, insert, update, delete on tables
    to anon, authenticated, service_role;
