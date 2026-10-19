-- A stand-in for the parts of Supabase the migrations lean on: the auth
-- schema and its uid(), the storage tables, and the three roles. Enough to
-- apply every migration to a plain Postgres and ask it real questions.
-- Roles belong to the whole server, not to one database, so a second run
-- finds them already there.
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon') $$;
create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
create schema storage; create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
create function storage.foldername(text) returns text[] language sql as $$ select string_to_array($1,'/') $$;
create schema extensions;
grant usage on schema public, auth to authenticated;
