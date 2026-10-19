const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'Sign in to delete your account.' }, 401);
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const publicKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
  const adminKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !publicKey || !adminKey) return json({ error: 'Account deletion is not configured yet.' }, 503);

  const authCheck = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { Authorization: authorization, apikey: publicKey } });
  if (!authCheck.ok) return json({ error: 'Your session has expired. Sign in again.' }, 401);
  const user = await authCheck.json();
  if (typeof user.id !== 'string') return json({ error: 'Could not verify your account.' }, 401);

  const deletion = await fetch(`${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(user.id)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminKey}`, apikey: adminKey },
  });
  if (!deletion.ok) {
    console.error('Supabase account deletion returned', deletion.status);
    return json({ error: 'Could not delete your account. Please try again or contact support.' }, 502);
  }
  return json({ success: true });
});
