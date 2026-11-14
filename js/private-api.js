import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
const config = window.privateMusicConfig || {};
export const configured = Boolean(config.supabaseUrl && config.supabaseKey);
// Keep the admin session out of persistent browser storage.
export const client = configured ? createClient(config.supabaseUrl, config.supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: false }
}) : null;
export async function request(action, values = {}, admin = false, keepalive = false) {
    if (!configured) throw new Error('Private music is not connected yet. Complete the backend setup to enable listening and sharing.');
    let authorization;
    if (admin) {
        const { data: { session }, error } = await client.auth.getSession();
        if (error || !session) throw new Error('Please sign in again.');
        authorization = `Bearer ${session.access_token}`;
    }
    const response = await fetch(`${config.supabaseUrl.replace(/\/$/, '')}/functions/v1/private-music`, {
        method: 'POST', cache: 'no-store', keepalive, headers: {
            'Content-Type': 'application/json', apikey: config.supabaseKey,
            ...(authorization ? { Authorization: authorization } : {})
        }, body: JSON.stringify({ ...values, action })
    });
    let data;
    try { data = await response.json(); } catch { throw new Error('The music service is unavailable. Please try again.'); }
    if (!response.ok) throw new Error(data.error || 'The music service is unavailable. Please try again.');
    return data;
}
