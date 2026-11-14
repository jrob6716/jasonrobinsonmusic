# Private music sharing

The public catalog stays at `/catalog/`. Private recipients use `/private/#<access-code>`;
only songs assigned to that link are returned. Manage uploads and shares at `/private/admin/`.
These pages can be hosted on the existing GitHub Pages site. Supabase provides the private
storage, admin authentication, database, and server function. No private audio belongs in Git.

## Activate

1. Create or choose a Supabase project. Run `backend/private-music.sql` once in its SQL editor, then apply
   `backend/migrations/002-private-music-management.sql`.
   This creates protected tables with RLS and no visitor grants, plus a **private** `private-music`
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
   New links can be retrieved again by your admin account. Older hash-only links must be
   kept from your original saved URLs. Reloading the admin page requires signing in again.
6. Open the copied link in a signed-out browser. Confirm it shows exactly the selected song.
   Create a second link with multiple songs and test next-song playback. Revoke a link and
   verify a fresh visit is rejected. Test a short expiration too.

For local testing, serve the repository over HTTP, and add the exact local origin (for example
`http://localhost:8765`) to `PRIVATE_MUSIC_ORIGINS` before redeploying the function. Do not open
HTML via `file://`. The frontend imports a pinned Supabase browser module from esm.sh.

## Daily use

- Upload audio from your computer in the admin screen (maximum 100 MB per file).
- Select one song for a single-song page, or several for a playlist. Tracks are listed newest
  first; use the ordering arrows to set playback order. A song can belong to multiple independent links.
- Set an optional expiration, then copy the link. Link dates are displayed in the user's local
  timezone. Anyone with the link can listen and can forward it.
- Use **Revoke link** to stop future access without affecting your other shares. To replace a
  lost link, create a new one and revoke the old share if needed.
- Use Manage songs for previews, metadata, audio replacement, version history, archive and
  deletion. Use the Supabase dashboard for password resets and storage maintenance.

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
- Track metadata is committed after successful upload. If metadata saving fails, the previous
  mix remains available. An administrator can recover or remove orphan objects through Storage.
- Passwords on individual shares, recipient-specific login, artwork uploads and automated
  orphan cleanup are not included. Management and activity features are described below.
- Supabase project storage limits and quotas still apply. For heavier public traffic, add
  gateway rate limiting for the unauthenticated resolve endpoint.

## Verification

```sh
deno check --node-modules-dir=none supabase/functions/private-music/index.ts
deno test --node-modules-dir=none --allow-env --allow-net supabase/functions/private-music/index.test.ts
node --check js/private-api.js
node --check js/private-admin.js
node --check js/private-player.js
```

Live deployment acceptance requires your configured Supabase project: upload, signed-out
playback, expired/revoked links, and rejection of a logged-in non-admin account.

API reference: [signed playback URLs](https://supabase.com/docs/reference/javascript/file-buckets-createsignedurl),
[signed uploads](https://supabase.com/docs/reference/javascript/file-buckets-uploadtosignedurl),
and [Edge Function authentication](https://supabase.com/docs/guides/functions/auth).

## Management and activity upgrade (v2)

For an existing installation, apply `backend/migrations/002-private-music-management.sql`
**before** deploying the updated function, then publish the frontend. For a fresh installation,
apply `private-music.sql` followed by that migration. The migration is additive and repeatable;
it seeds version history from current files and preserves all original song IDs and token hashes.

- **Manage songs:** preview, edit, replace audio, restore an earlier version, archive/unarchive,
  and permanently delete. Replacement uses an immutable storage path and an atomic pointer
  switch; old links load the current version on their next open. Concurrent saves are checked.
- **Archive** hides a song from new selections, preserving current links. **Delete** blocks
  access first, removes the song from multi-song selections, revokes single-song selections,
  and removes all audio versions. A title confirmation lists affected shares. If storage
  cleanup fails, the admin shows a retry action. Metadata and historical totals remain as
  tombstones; this is audio deletion, not erasure of analytics records.
- **Shared links:** internal recipient labels, public personal messages, selection editing,
  expiration changes and playlist ordering. Revoked links cannot be reactivated by editing.
  New link codes are encrypted server-side (AES-GCM, bound to share ID), allowing authenticated
  admins to retrieve them. Codes are never returned by list/analytics/recipient endpoints.
  Legacy hash-only links remain valid but cannot be recovered from their hashes.
- Encryption derives from the server-only `PRIVATE_MUSIC_LINK_KEY`, falling back to the
  existing service-role secret for a setup without another credential. Keep that derivation
  stable. Rotating/changing it without migrating ciphertext disables retrieval of earlier
  new links; the already-shared URLs still validate against their original hashes.
- **Activity:** one page visit per ephemeral page session; one playback start per song version
  per page session. Cumulative time is upserted, so retries/resumes do not increase start counts.
  30 seconds of audio playback qualifies as engaged. Coverage merges played ranges, so replaying
  an intro or seeking to the end cannot produce a completion. 25/50/75/90% milestones count
  coverage; 90% is displayed as completion. At faster playback rates these are audio seconds,
  not wall-clock seconds. Refresh activity to load new totals.
- Activity is disclosed on the listener page. No IP address, fingerprint, email, persistent
  listener cookie or cross-site analytics SDK is recorded. Recipient labels identify a link,
  not a verified person. Counts can be blocked or forged; they are engagement estimates.
  History begins when this upgrade is deployed, not retroactively.
- The new admin requires function API version 2; publish only after the migration and backend.

Validation: `npm ci`, `npx playwright install chromium`, `npm test`, and `npm run test:browser`.
Database tests use an isolated PostgreSQL-compatible PGlite instance. Browser tests use mock
API/storage responses and never mutate a Supabase project. Deno can also check with
`deno check --node-modules-dir=none supabase/functions/private-music/index.ts`.
