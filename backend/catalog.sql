-- Run in a Supabase project's SQL editor. Only aggregate activity is public.
create table if not exists public.catalog_tracks (id text primary key);
create table if not exists public.catalog_hearts (
 track_id text references public.catalog_tracks(id) not null,
 listener_id uuid not null,
 primary key(track_id, listener_id)
);
create table if not exists public.catalog_plays (
 track_id text references public.catalog_tracks(id) not null,
 listener_id uuid not null,
 played_at timestamptz not null default now(),
 primary key(track_id, listener_id)
);
create table if not exists public.catalog_counts (
 track_id text primary key references public.catalog_tracks(id),
 plays bigint not null default 0
);
alter table public.catalog_tracks enable row level security;
alter table public.catalog_hearts enable row level security;
alter table public.catalog_plays enable row level security;
alter table public.catalog_counts enable row level security;
revoke all on public.catalog_tracks, public.catalog_hearts, public.catalog_plays, public.catalog_counts from anon, authenticated;
create or replace function public.catalog_totals() returns jsonb
language sql security definer set search_path = '' as $$
 select coalesce(jsonb_agg(jsonb_build_object('track_id', t.id, 'plays', coalesce(c.plays,0), 'hearts', (select count(*) from public.catalog_hearts h where h.track_id=t.id))), '[]'::jsonb)
 from public.catalog_tracks t left join public.catalog_counts c on c.track_id=t.id;
$$;
create or replace function public.catalog_heart(track_id text, listener_id uuid, liked boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
 if not exists(select 1 from public.catalog_tracks t where t.id=$1) then raise exception 'Unknown track'; end if;
 if $3 then insert into public.catalog_hearts values($1,$2) on conflict do nothing;
 else delete from public.catalog_hearts h where h.track_id=$1 and h.listener_id=$2; end if;
 return jsonb_build_object('plays', coalesce((select c.plays from public.catalog_counts c where c.track_id=$1),0), 'hearts', (select count(*) from public.catalog_hearts h where h.track_id=$1));
end $$;
create or replace function public.catalog_play(track_id text, listener_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare accepted integer;
begin
 if not exists(select 1 from public.catalog_tracks t where t.id=$1) then raise exception 'Unknown track'; end if;
 -- A listener may contribute at most one play per track in a 30-minute window.
 insert into public.catalog_plays as p values($1,$2,now())
 on conflict on constraint catalog_plays_pkey do update set played_at=now()
 where p.played_at < now()-interval '30 minutes';
 get diagnostics accepted = row_count;
 if accepted > 0 then
  insert into public.catalog_counts as c values($1,1)
  on conflict on constraint catalog_counts_pkey do update set plays=c.plays+1;
 end if;
 return jsonb_build_object('plays', coalesce((select c.plays from public.catalog_counts c where c.track_id=$1),0), 'hearts', (select count(*) from public.catalog_hearts h where h.track_id=$1));
end $$;
revoke all on function public.catalog_totals(), public.catalog_heart(text,uuid,boolean), public.catalog_play(text,uuid) from public;
grant execute on function public.catalog_totals(), public.catalog_heart(text,uuid,boolean), public.catalog_play(text,uuid) to anon;
insert into public.catalog_tracks(id) values
('Hip Hop & Pop/Memories of you.mp3'),
('Hip Hop & Pop/Let your body Talk.mp3'),
('Hip Hop & Pop/Just Chill.mp3'),
('Hip Hop & Pop/Bad for me.mp3'),
('Hip Hop & Pop/Lets Talk.mp3'),
('Hip Hop & Pop/Shes Poison.mp3'),
('Hip Hop & Pop/Insomnia_V1_RichardVission_Bianca_LorenMoore_JR._JBmp3.mp3'),
('Hip Hop & Pop/Obsessed.mp3'),
('Hip Hop & Pop/Tough Love .m4a'),
('Hip Hop & Pop/Karma .mp3'),
('Hip Hop & Pop/Do Sexy .m4a'),
('Hip Hop & Pop/Patience_V2D.mp3'),
('Hip Hop & Pop/Eyes.mp3'),
('Hip Hop & Pop/Breathless.mp3'),
('Hip Hop & Pop/Physical Attraction.m4a'),
('Hip Hop & Pop/Memories.mp3'),
('Hip Hop & Pop/Hey Man.mp3'),
('Cinematic & Emotional/Send Me an Angel Trailer.mp3'),
('Cinematic & Emotional/Creep Trailer .mp3'),
('Cinematic & Emotional/Love somebody.m4a'),
('Cinematic & Emotional/Wish you were here.mp3'),
('Cinematic & Emotional/Phases .mp3'),
('Cinematic & Emotional/Ride.mp3'),
('Cinematic & Emotional/Serene dream.mp3'),
('Pop | Indie | Rock/See me Falling.mp3'),
('Pop | Indie | Rock/Dreamers unafraid.mp3'),
('Pop | Indie | Rock/Lost with you .mp3'),
('Pop | Indie | Rock/Tell Me .mp3'),
('Pop | Indie | Rock/OPEN HEART JR .m4a'),
('Pop | Indie | Rock/BIG POP DRUMS JR .m4a'),
('Pop | Indie | Rock/The Nightscape.m4a'),
('Sophisticated Grooves/Cat and Mouse.mp3'),
('Sophisticated Grooves/Whoop whoop .mp3'),
('Sophisticated Grooves/Island Fever.wav'),
('Sophisticated Grooves/Mitsubishi .mp3'),
('Sophisticated Grooves/Promises .mp3'),
('Sophisticated Grooves/Dont do it.mp3'),
('Electronic & Ambient/Prism.mp3'),
('Electronic & Ambient/Sigmatic.mp3'),
('Electronic & Ambient/Advanced Stimulation.mp3'),
('Electronic & Ambient/Bass Gorilla .mp3'),
('Dance & Club/Kickdrum .m4a'),
('Dance & Club/Big Fun.m4a'),
('Dance & Club/IN MY UNIVERSE.m4a'),
('Dance & Club/THE MOMENT.m4a'),
('Dance & Club/In My Dreams.m4a'),
('Dance & Club/Forever young.mp3'),
('Dance & Club/Without you.mp3'),
('Dance & Club/Like this.mp3'),
('Dance & Club/Turn Up The Bass.mp3'),
('Dance & Club/Turn up the Party.m4a'),
('Remix/4 Flipsyde - When it was good ( Dirty Freqs Remix ).mp3'),
('Remix/With You (Dave Aude Club Remix).mp3'),
('Remix/Aftermath (Here We Go).mp3'),
('Remix/11 Kenneth Thomas - Stronger Creature ( Dirty Freqs Radio Vox Remix ).mp3'),
('Remix/Natalia Kills - Wonderland ( Dirty Freqs Remix ).mp3'),
('Remix/ZZ Ward -Last Love Song -Dave Aude Remix.mp3'),
('Remix/Gas Pedal - Sage The Gemini feat. IAMSU (Dave Aude Remix).mp3'),
('Remix/Bastille "Bad Blood" (Dave Aude Radio Edit).mp3'),
('Remix/Bullet (Ikon And Exodus Remix).mp3'),
('Remix/Electricity & Drums (Bad Boy) (DJ Ikon Club).mp3'),
('Remix/1 Richard Vission & Static Revenger Ft. Luciana - I Like That ( Dirty Freqs Remix ).mp3'),
('Remix/London Rose- Kick Drum (Dave Aude'' Radio Mix).mp3'),
('Remix/Dave Audé ft Cierra Sample in "CIRCLES".mp3'),
('Remix/Mayra Veronica - Ay Mama Mia (Dave Audé Radio Edit).mp3'),
('Remix/7 Tiff Lacey - What You Do For Me ( Dirty Freqs ).mp3'),
('Remix/Come & Get It (Dave Audé Club Remix).mp3'),
('Remix/The McClymonts "Here''s To You And I" (Dave Audé Radio).mp3'),
('Remix/8 Beyonce - Sweet Dreams ( Dirty Freqs Remix  ).mp3'),
('Remix/2 Esmee Denters - Admit it (Dirty Freqs Club Mix).mp3'),
('Remix/15 Alternative Reality - All About You ( Dirty Freqs Remix ).mp3'),
('Remix/Lance Bass & Anise K ft Bella Blue "Walking On Air" (Dave Audé Radio).mp3'),
('Remix/Five Knives -The Rising (Dave Aude Radio Mix).mp3'),
('Remix/LeAnn Rimes "Carol Of The Bells".mp3'),
('Remix/Dave Audé ft Andy Bell - Aftermath (Here We Go) (Dave''s Afterhours Remix).mp3'),
('Remix/If I Lose Myself Tonight (DJ Ikon Remix).mp3'),
('Remix/Ella Henderson "Ghost" (Dave Audé Remix).mp3'),
('Remix/14 Keri Hilson - Energy ( Dirty Freqs Remix ).mp3'),
('Remix/5 Paula Abdul - For the Music (  Dirty Freqs Remix ).mp3'),
('Remix/Zedd - Find You (Dave Audé Radio Remix).mp3'),
('Remix/Chris Brown, Usher & Rick Ross "New Flame" (Dave Audé Club Mix).mp3'),
('Remix/Tinashe - Pretend - Dave Aude Remix (Dirty).mp3'),
('Remix/Mel B - For Once In My Life (Dave Aude Remix).mp3'),
('Remix/3 I Like it (Dirty Freqs Remix ).mp3'),
('Remix/Cherry Cherry Boom Boom - A Little Bit Of Love (Dave Audé Edit).mp3'),
('Remix/16 Alternative Reality - New Nation ( Dirty Freqs Remix ).mp3'),
('Remix/Noelia ft. Timbaland "Spell" (Dave Aude Radio).mp3'),
('Remix/Dave Audé feat. Jessica Sutta "Im Gonna Get You" (Radio Mix).mp3'),
('Remix/9 Not Over ft. Ryan Tedder ( Dirty Freqs RMX ).mp3'),
('Remix/13 Talla 2XLC - I Know feat. Susana ( DirtyFreqs Remix ).mp3'),
('Remix/Gali "Tomorrow Never Dies" (Dave Audé Ext. Mix Radio Edit).mp3'),
('Remix/Dirty Loops - Hit Me (Dave Audé Radio).mp3'),
('Remix/Moves Like Jagger ( Dirty Freqs Remix ).mp3'),
('Remix/Beyonce - Partition (Dave Aude Twerk Remix).mp3'),
('Remix/Gia "World" (Dave Aude Radio Mix).mp3'),
('Remix/10 Kenneth Thomas - Wish you were here ( Dirty Freqs Remix ).mp3'),
('Remix/12 Ida Corr - IPMFIY Dirty Freqs Mix.mp3'),
('Remix/Ariana Grande ft. Iggy Azalea "Problem" (Dave Audé Twerk Remix).mp3'),
('Remix/G R L "Uglyheart" (Dave Aude Radio Edit).mp3'),
('Remix/Malea - One hot mess ( Dave Aude Remix ).mp3'),
('Remix/Nikkole "Zero" (Dave Audé Edit).mp3'),
('Remix/6 Jonathan Davis - Got Money - ( Dirty Fr3qs Remix ).mp3'),
('Remix/Ciara "Body Party" (Dave Audé Radio).mp3'),
('Remix/17 Paul Oakenfold - Sleeping Satellite ( Dirty Freqs Remix ).mp3'),
('Remix/Making Paper (Ikon Remix).m4a'),
('Remix/10 Hilary Duff - Anyday ( Co-Produced for Richard Vission ).mp3'),
('Remix/7 Eva Simons - Silly Boy ( Co-Produced for Richard Vission ).mp3'),
('Remix/8 Pussycat Dolls - Bottle Pop ( Co-Produced for Richard Vission ).mp3'),
('Remix/4 U2 - Magnificent - ( Co-Produced for Richard Vission ).mp3'),
('Remix/11 Morning After - Richard Vission Remix.mp3'),
('Remix/3 Hilary Duff - Reach Out ( Co-Produced for Richard Vission ).mp3'),
('Remix/6 Will.I.am - Get Ya Money ( Co-Produced for Richard Vission ).mp3'),
('Remix/2 Katy Perry - Kissed A Girl ( Co-Produced for Richard Vission ).mp3'),
('Remix/1 Weezer - Trouble Maker ( Co-Produced for Richard Vission ).mp3'),
('Remix/5 David May - Super Star ( Co-Produced for Richard Vission ).mp3'),
('Remix/9 One Republic - Apologize ( Co-Produced for Richard Vission ).mp3')
on conflict do nothing;
