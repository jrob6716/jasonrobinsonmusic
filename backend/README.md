# Catalog activity (future integration)

The catalog is served at `/catalog/` by GitHub Pages. Audio and genre/order data use the existing `js/catalog-data.js` catalog.

To activate shared activity:
1. Apply `catalog.sql` to a Supabase project. It seeds the permitted catalog tracks, enables RLS, and exposes only aggregate RPCs to anonymous clients. Listener identifiers are not readable by visitors.
2. Set the project URL and public publishable/anon key in `js/catalog-config.js`. Never publish a service-role/secret key.
3. Deploy both the configuration and page. Verify hearts and totals from two browser profiles.

Play counts and client-side play tracking have been removed from the catalog. The SQL play functions are retained here for possible future use. The database accepts at most one play per track per anonymous browser identity in 30 minutes. Hearts are idempotent per browser identity. No account is required; clearing browser storage creates a new identity. These are engagement indicators, not fraud-proof audited streaming metrics.

Without a configured database the page stores favorites locally and explains that they are saved on this device. New tracks must also be added to the database allowlist.
