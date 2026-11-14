# Private music sharing

The public catalog stays at `/catalog/`. Private recipients use `/private/#<access-code>`;
only songs assigned to that link are returned. Manage uploads and shares at `/private/admin/`.
These pages can be hosted on the existing GitHub Pages site. Supabase provides the private
storage, admin authentication, database, and server function. No private audio belongs in Git.

## Activate

1. Create or choose a Supabase project. Run `backend/private-music.sql` once in its SQL editor.
   This creates three tables with RLS and no visitor grants, plus a **private** `private-music`
   storage bucket. Keep the bucket private and do not add public object-read policies.
2. In Authentication > Users, create your admin user with an email and password. Disable public
   user signups if you do not need them. Copy the user's UUID and run:
   ```sql
   insert into public.private_music_admins (user_id) values ('YOUR-AUTH-USER-UUID');
   ```
   A signed-in account without this allowlist entry cannot manage music.
3. Install the Supabase CLI, sign in, and run these from the repository root:
   ```sh
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   supabase secrets set PRIVATE_MUSIC_ORIGINS=https://dirtyfreqs.com,https://www.dirtyfreqs.com
   supabase functions deploy private-music --no-verify-jwt
   ```
   `--no-verify-jwt` allows recipients without accounts to resolve a share. Every admin
   action independently verifies the user JWT and the admin allowlist. The service-role
   credential is available inside the function; it must never be placed in browser code.
4. Fill in `js/private-config.js` with the project's URL and **public publishable/anon key**.
   This configuration is separate from the public catalog's activity configuration.
5. Deploy the repository through the existing GitHub Pages workflow. Visit `/private/admin/`
   and sign in. Upload an MP3, select it, enter a selection title, and create a link.
   Save the resulting link immediately: only its SHA-256 hash is stored in the database.
   Reloading the admin page requires signing in again and does not recover old link URLs.
6. Open the copied link in a signed-out browser. Confirm it shows exactly the selected song.
   Create a second link with multiple songs and test next-song playback. Revoke a link and
   verify a fresh visit is rejected. Test a short expiration too.

For local testing, serve the repository over HTTP, and add the exact local origin (for example
`http://localhost:8765`) to `PRIVATE_MUSIC_ORIGINS` before redeploying the function. Do not open
HTML via `file://`. The frontend imports a pinned Supabase browser module from esm.sh.

## Daily use

- Upload audio from your computer in the admin screen (maximum 100 MB per file).
- Select one song for a single-song page, or several for a playlist. Tracks are listed newest
  first, and selections play in that order. A song can belong to multiple independent links.
- Set an optional expiration, then copy the link. Link dates are displayed in the user's local
  timezone. Anyone with the link can listen and can forward it.
- Use **Revoke link** to stop future access without affecting your other shares. To replace a
  lost link, create a new one and revoke the old share if needed.
- Use the Supabase dashboard for password resets, storage maintenance, and deleting audio.
  Deleting a song's storage object breaks any shares that reference it.

## Access behavior and limits

- Share codes contain 256 random bits, live in the URL fragment, and are sent to the backend in
  POST bodies. They are not sent to the static host in page requests. Pages request no indexing
  and no referrer forwarding. Those page directives are not the access control.
- The function checks share existence, revocation, and expiration before issuing audio URLs.
  URLs last at most five minutes, bounded by link expiration. Selecting a song refreshes its
  URL; after a long pause or network error, reselect the song to reconnect.
- Revocation cannot recall buffered audio, recordings, or a file someone already saved. A
  previously issued URL may accept requests until it expires. Hiding the download control is
  presentation only, not copy protection.
- The admin session exists in memory only. Sign out when finished; reloading requires login.
- Track metadata is saved after successful upload. If metadata saving fails, the UI reports the
  object path so an administrator can recover or remove the orphan in the Supabase dashboard.
- No passwords on individual shares, recipient-specific login, artwork uploads, analytics,
  custom playlist ordering, or automated orphan cleanup are included in this first version.
- Supabase project storage limits and quotas still apply. For heavier public traffic, add
  gateway rate limiting for the unauthenticated resolve endpoint.

## Verification

```sh
deno check supabase/functions/private-music/index.ts
deno test --allow-env --allow-net supabase/functions/private-music/index.test.ts
node --check js/private-api.js
node --check js/private-admin.js
node --check js/private-player.js
```

Live deployment acceptance requires your configured Supabase project: upload, signed-out
playback, expired/revoked links, and rejection of a logged-in non-admin account.

API reference: [signed playback URLs](https://supabase.com/docs/reference/javascript/file-buckets-createsignedurl),
[signed uploads](https://supabase.com/docs/reference/javascript/file-buckets-uploadtosignedurl),
and [Edge Function authentication](https://supabase.com/docs/guides/functions/auth).
