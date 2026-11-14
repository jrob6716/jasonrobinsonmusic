-- Apply once in the Supabase SQL editor, then authorize your Auth user below.
create table public.private_music_admins (
 user_id uuid primary key references auth.users(id) on delete cascade
);
create table public.private_music_tracks (
 id uuid primary key default gen_random_uuid(),
 title text not null check (length(title) between 1 and 200),
 subtitle text not null default '' check (length(subtitle) <= 300),
 storage_path text not null unique,
 created_at timestamptz not null default now()
);
create table public.private_music_shares (
 id uuid primary key default gen_random_uuid(),
 title text not null check (length(title) between 1 and 200),
 token_hash text not null unique,
 track_ids uuid[] not null check (cardinality(track_ids) between 1 and 100),
 expires_at timestamptz,
 revoked_at timestamptz,
 created_at timestamptz not null default now()
);
alter table public.private_music_admins enable row level security;
alter table public.private_music_tracks enable row level security;
alter table public.private_music_shares enable row level security;
-- All access goes through the function; even logged-in users cannot query these tables.
revoke all on public.private_music_admins, public.private_music_tracks, public.private_music_shares from anon, authenticated;
grant all on public.private_music_admins, public.private_music_tracks, public.private_music_shares to service_role;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('private-music', 'private-music', false, 104857600,
 array['audio/mpeg','audio/mp4','audio/x-m4a','audio/wav','audio/x-wav','audio/flac','audio/x-flac','audio/ogg','audio/aac'])
on conflict (id) do nothing;
-- No storage policies: upload and playback require narrowly scoped signed URLs.
-- After creating your user in Authentication > Users, run with its actual UUID:
-- insert into public.private_music_admins (user_id) values ('YOUR-AUTH-USER-UUID');
