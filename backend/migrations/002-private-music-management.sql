-- Additive upgrade. Existing songs, share codes, and links are preserved.
begin;
alter table public.private_music_tracks
 add column if not exists archived_at timestamptz,
 add column if not exists deleted_at timestamptz,
 add column if not exists cleanup_pending boolean not null default false,
 add column if not exists current_version_id uuid;
alter table public.private_music_shares
 add column if not exists recipient_label text not null default '' check(length(recipient_label)<=200),
 add column if not exists message text not null default '' check(length(message)<=2000),
 add column if not exists token_encrypted text;
create table if not exists public.private_music_versions (
 id uuid primary key default gen_random_uuid(),
 track_id uuid not null references public.private_music_tracks(id),
 storage_path text not null unique,
 label text not null check(length(label) between 1 and 100),
 created_at timestamptz not null default now()
);
insert into public.private_music_versions(track_id,storage_path,label)
 select id,storage_path,'Original upload' from public.private_music_tracks
 on conflict(storage_path) do nothing;
update public.private_music_tracks t set current_version_id=v.id
 from public.private_music_versions v where t.storage_path=v.storage_path and t.current_version_id is null;
-- Compatibility for an upload already in flight from the original admin during rollout.
create or replace function public.private_music_seed_version() returns trigger
 language plpgsql security definer set search_path='' as $$
declare version uuid;
begin
 if new.current_version_id is null then
  insert into public.private_music_versions(track_id,storage_path,label) values(new.id,new.storage_path,'Original upload') returning id into version;
  update public.private_music_tracks set current_version_id=version where id=new.id;
 end if;
 return new;
end $$;
drop trigger if exists private_music_initial_version on public.private_music_tracks;
create trigger private_music_initial_version after insert on public.private_music_tracks
 for each row execute function public.private_music_seed_version();
revoke all on function public.private_music_seed_version() from public,anon,authenticated;
create table if not exists public.private_music_visits (
 share_id uuid not null references public.private_music_shares(id),
 session_id uuid not null,
 opened_at timestamptz not null default now(),
 primary key(share_id,session_id)
);
create table if not exists public.private_music_listens (
 share_id uuid not null,
 session_id uuid not null,
 version_id uuid not null references public.private_music_versions(id),
 track_id uuid not null references public.private_music_tracks(id),
 started_at timestamptz not null default now(),
 last_at timestamptz not null default now(),
 seconds double precision not null default 0 check(seconds between 0 and 86400),
 progress integer not null default 0 check(progress in (0,25,50,75,90)),
 primary key(share_id,session_id,version_id),
 foreign key(share_id,session_id) references public.private_music_visits(share_id,session_id)
);
alter table public.private_music_versions enable row level security;
alter table public.private_music_visits enable row level security;
alter table public.private_music_listens enable row level security;
revoke all on public.private_music_versions,public.private_music_visits,public.private_music_listens from anon,authenticated;
grant all on public.private_music_versions,public.private_music_visits,public.private_music_listens to service_role;
create index if not exists private_music_listens_version on public.private_music_listens(version_id);

-- Row locks make replacement/restore atomic and detect stale admin forms.
create or replace function public.private_music_save_audio(
 p_id uuid,p_version uuid,p_path text,p_label text,p_expected uuid,p_title text default null,p_subtitle text default ''
) returns void language plpgsql security definer set search_path='' as $$
declare t public.private_music_tracks;
begin
 if not exists(select 1 from storage.objects where bucket_id='private-music' and name=p_path) then raise exception 'Upload not found'; end if;
 if p_expected is null then
  insert into public.private_music_tracks(id,title,subtitle,storage_path,current_version_id)
   values(p_id,p_title,p_subtitle,p_path,p_version);
 else
  select * into t from public.private_music_tracks where id=p_id for update;
  if not found or t.deleted_at is not null then raise exception 'Song unavailable'; end if;
  if t.current_version_id<>p_expected then raise exception 'Song changed. Refresh and try again'; end if;
  update public.private_music_tracks set storage_path=p_path,current_version_id=p_version where id=p_id;
 end if;
 insert into public.private_music_versions(id,track_id,storage_path,label) values(p_version,p_id,p_path,p_label);
end $$;
create or replace function public.private_music_restore_audio(p_id uuid,p_version uuid,p_expected uuid)
 returns void language plpgsql security definer set search_path='' as $$
declare t public.private_music_tracks; v public.private_music_versions;
begin
 select * into t from public.private_music_tracks where id=p_id for update;
 if not found or t.deleted_at is not null then raise exception 'Song unavailable'; end if;
 if t.current_version_id<>p_expected then raise exception 'Song changed. Refresh and try again'; end if;
 select * into v from public.private_music_versions where id=p_version and track_id=p_id;
 if not found then raise exception 'Version unavailable'; end if;
 update public.private_music_tracks set storage_path=v.storage_path,current_version_id=v.id where id=p_id;
end $$;
create or replace function public.private_music_delete_song(p_id uuid) returns void
 language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.private_music_tracks where id=p_id for update;
 if not found then raise exception 'Song unavailable'; end if;
 update public.private_music_tracks set deleted_at=coalesce(deleted_at,now()),cleanup_pending=true where id=p_id;
 -- Other songs in a playlist keep playing. Single-song shares are revoked.
 update public.private_music_shares set track_ids=array_remove(track_ids,p_id)
  where p_id=any(track_ids) and cardinality(track_ids)>1;
 update public.private_music_shares set revoked_at=coalesce(revoked_at,now()) where p_id=any(track_ids);
end $$;
-- Lock selected songs while saving a share so deletion cannot leave a new broken link.
create or replace function public.private_music_save_share(
 p_id uuid,p_title text,p_recipient text,p_message text,p_tracks uuid[],p_expiry timestamptz,
 p_hash text default null,p_encrypted text default null
) returns void language plpgsql security definer set search_path='' as $$
declare existing uuid[];
begin
 perform 1 from public.private_music_tracks where id=any(p_tracks) order by id for update;
 if (select count(*) from public.private_music_tracks where id=any(p_tracks) and deleted_at is null)<>cardinality(p_tracks) then raise exception 'A selected song is unavailable'; end if;
 if p_hash is null then
  select track_ids into existing from public.private_music_shares where id=p_id for update;
  if not found then raise exception 'Share unavailable'; end if;
 else existing:='{}'::uuid[];
 end if;
 if exists(select 1 from public.private_music_tracks where id=any(p_tracks) and archived_at is not null and not(id=any(existing))) then raise exception 'A selected song is archived'; end if;
 if p_hash is null then
  update public.private_music_shares set title=p_title,recipient_label=p_recipient,message=p_message,track_ids=p_tracks,expires_at=p_expiry where id=p_id;
 else
  insert into public.private_music_shares(id,title,recipient_label,message,track_ids,expires_at,token_hash,token_encrypted)
   values(p_id,p_title,p_recipient,p_message,p_tracks,p_expiry,p_hash,p_encrypted);
 end if;
end $$;
-- Retain max cumulative time per page session/version. Retries do not add plays or time.
create or replace function public.private_music_record_listen(
 p_share uuid,p_session uuid,p_track uuid,p_version uuid,p_seconds double precision,p_duration double precision,p_coverage double precision
) returns void language plpgsql security definer set search_path='' as $$
declare first_seen timestamptz; bounded double precision; pct integer;
begin
 select opened_at into first_seen from public.private_music_visits where share_id=p_share and session_id=p_session;
 if not found then return; end if;
 bounded:=least(greatest(p_seconds,0),86400,greatest(0,4*extract(epoch from now()-first_seen)+2));
 pct:=case when p_duration>0 and least(bounded,p_coverage)>=p_duration*0.9 then 90
           when p_duration>0 and least(bounded,p_coverage)>=p_duration*0.75 then 75
           when p_duration>0 and least(bounded,p_coverage)>=p_duration*0.5 then 50
           when p_duration>0 and least(bounded,p_coverage)>=p_duration*0.25 then 25 else 0 end;
 insert into public.private_music_listens(share_id,session_id,track_id,version_id,seconds,progress)
 values(p_share,p_session,p_track,p_version,bounded,pct)
 on conflict(share_id,session_id,version_id) do update set
  seconds=greatest(public.private_music_listens.seconds,excluded.seconds),
  progress=greatest(public.private_music_listens.progress,excluded.progress),last_at=now();
end $$;
create or replace function public.private_music_activity() returns jsonb
 language sql security definer set search_path='' as $$
 select jsonb_build_object(
 'shares',coalesce((select jsonb_agg(x) from (
  select s.id,
   (select count(*) from public.private_music_visits v where v.share_id=s.id) as opens,
   (select count(*) from public.private_music_listens l where l.share_id=s.id) as starts,
   (select count(*) from public.private_music_listens l where l.share_id=s.id and l.seconds>=30) as engaged,
   (select count(*) from public.private_music_listens l where l.share_id=s.id and l.progress>=90) as completions,
   (select max(at) from (select v.opened_at as at from public.private_music_visits v where v.share_id=s.id
    union all select l.last_at from public.private_music_listens l where l.share_id=s.id) a) as last_at
  from public.private_music_shares s) x),'[]'::jsonb),
 'versions',coalesce((select jsonb_agg(x) from (
  select v.id,v.track_id,v.label,count(l.version_id) as starts,
   count(*) filter(where l.seconds>=30) as engaged,
   count(*) filter(where l.progress>=25) as p25,count(*) filter(where l.progress>=50) as p50,
   count(*) filter(where l.progress>=75) as p75,count(*) filter(where l.progress>=90) as completions,
   coalesce(round(sum(l.seconds)::numeric),0) as seconds,max(l.last_at) as last_at
  from public.private_music_versions v left join public.private_music_listens l on l.version_id=v.id
  group by v.id) x),'[]'::jsonb));
$$;
revoke all on function public.private_music_save_audio(uuid,uuid,text,text,uuid,text,text),
 public.private_music_restore_audio(uuid,uuid,uuid),public.private_music_delete_song(uuid),
 public.private_music_record_listen(uuid,uuid,uuid,uuid,double precision,double precision,double precision),public.private_music_activity(),public.private_music_save_share(uuid,text,text,text,uuid[],timestamptz,text,text) from public,anon,authenticated;
grant execute on function public.private_music_save_audio(uuid,uuid,text,text,uuid,text,text),
 public.private_music_restore_audio(uuid,uuid,uuid),public.private_music_delete_song(uuid),
 public.private_music_record_listen(uuid,uuid,uuid,uuid,double precision,double precision,double precision),public.private_music_activity(),public.private_music_save_share(uuid,text,text,text,uuid[],timestamptz,text,text) to service_role;
commit;
