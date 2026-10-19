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
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'Sign in to scan ingredients.' }, 401);
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
  if (!supabaseUrl || !supabaseKey) return json({ error: 'Supabase auth is not configured.' }, 503);

  const authCheck = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { Authorization: authorization, apikey: supabaseKey } });
  if (!authCheck.ok) return json({ error: 'Your session has expired. Sign in again.' }, 401);

  let body: { imageBase64?: unknown; mimeType?: unknown; mode?: unknown };
  try { body = await request.json(); } catch { return json({ error: 'Send a valid image request.' }, 400); }
  const imageBase64 = typeof body.imageBase64 === 'string' ? body.imageBase64.replace(/^data:[^;]+;base64,/, '') : '';
  const mimeType = typeof body.mimeType === 'string' ? body.mimeType : 'image/jpeg';
  const mode = body.mode === 'receipt' ? 'receipt' : body.mode === 'meal' ? 'meal' : 'fridge';
  if (!imageBase64 || imageBase64.length > 6_000_000 || !['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
    return json({ error: 'Use a clear JPEG, PNG, or WebP image under 4.5 MB.' }, 400);
  }

  const apiKey = Deno.env.get('GROQ_API_KEY');
  const model = Deno.env.get('GROQ_VISION_MODEL') ?? 'qwen/qwen3.8-27b';
  if (!apiKey) return json({ error: 'Photo scanning is not configured yet.' }, 503);

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: mode === 'receipt'
              ? 'Read this grocery receipt and extract only clearly identifiable food ingredients. Ignore prices, totals, discounts, household goods, and uncertain abbreviations. Do not guess. Return JSON only: {"ingredients":["name"]}. Use short common ingredient names, no amounts, maximum 30 items.'
              : mode === 'meal'
                ? 'Estimate nutrition for the visible plated meal and its visible portion only. This is an uncertain visual estimate; do not imply medical accuracy. Give one best estimate for the whole pictured plate, not per 100 g. Return JSON only: {"mealDescription":"short description","calories":650,"proteinGrams":32,"carbsGrams":72,"fatGrams":24,"confidence":"low|medium|high"}. Use whole-number estimates, confidence low if portion size or ingredients are unclear.'
                : 'Identify clearly visible food ingredients in this fridge photo. Do not guess hidden or uncertain items. Return JSON only: {"ingredients":["name"]}. Use short common ingredient names, no amounts, maximum 30 items.' },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
          ],
        }],
      }),
      signal: AbortSignal.timeout(35_000),
    });
    if (!response.ok) {
      console.error('Image provider returned', response.status);
      return json({ error: 'Could not read the photo right now. Try again or type the ingredients.' }, 502);
    }
    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;
    const decoded = typeof content === 'string' ? JSON.parse(content) : null;
    if (mode === 'meal') {
      const nutrition = {
        calories: Number(decoded?.calories),
        proteinGrams: Number(decoded?.proteinGrams),
        carbsGrams: Number(decoded?.carbsGrams),
        fatGrams: Number(decoded?.fatGrams),
      };
      if (Object.values(nutrition).some((value) => !Number.isFinite(value) || value < 0 || value > 4000)) {
        return json({ error: 'Could not estimate that plate clearly. Try a brighter photo from directly above.' }, 422);
      }
      return json({
        mealDescription: typeof decoded?.mealDescription === 'string' ? decoded.mealDescription.slice(0, 120) : 'Meal photo estimate',
        nutrition,
        confidence: ['low', 'medium', 'high'].includes(decoded?.confidence) ? decoded.confidence : 'low',
      });
    }
    const ingredients = Array.isArray(decoded?.ingredients)
      ? decoded.ingredients.filter((item: unknown): item is string => typeof item === 'string').map((item: string) => item.trim()).filter(Boolean).slice(0, 30)
      : [];
    if (!ingredients.length) return json({ error: 'No clear ingredients found. Try a brighter photo or type them in.' }, 422);
    return json({ ingredients });
  } catch (error) {
    console.error('Ingredient scan failed', error instanceof Error ? error.message : 'Unknown error');
    return json({ error: 'Photo scanning failed. Try again shortly.' }, 502);
  }
});
