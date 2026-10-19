const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'Sign in to generate recipes.' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
  if (!supabaseUrl || !supabaseKey) return json({ error: 'Supabase auth is not configured.' }, 503);

  const authCheck = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: authorization, apikey: supabaseKey },
  });
  if (!authCheck.ok) return json({ error: 'Your session has expired. Sign in again.' }, 401);

  let body: { ingredients?: unknown; servings?: unknown; preferences?: unknown; allergies?: unknown; maxCookMinutes?: unknown; budgetLevel?: unknown; equipment?: unknown; skillLevel?: unknown; cookingDaysPerWeek?: unknown; macroTargets?: unknown; mode?: unknown; craving?: unknown; swapOut?: unknown; swapIn?: unknown; count?: unknown; remix?: unknown };
  try { body = await request.json(); } catch { return json({ error: 'Send a valid JSON request.' }, 400); }

  const ingredients = Array.isArray(body.ingredients)
    ? body.ingredients.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean).slice(0, 20)
    : [];
  if (ingredients.some((item) => item.length > 80)) {
    return json({ error: 'Ingredient names must be under 80 characters.' }, 400);
  }

  const mode = ['PantryChef', 'MasterChef', 'MixologyMaestro', 'BakeHeist', 'MacrosChef', 'WeeklyPlan'].includes(String(body.mode)) ? String(body.mode) : 'PantryChef';
  const craving = typeof body.craving === 'string' ? body.craving.trim().slice(0, 120) : '';
  if (mode === 'PantryChef' && !ingredients.length) return json({ error: 'Add at least one pantry ingredient.' }, 400);
  if (mode === 'MasterChef' && !craving) return json({ error: 'Tell the recipe studio what meal you are craving.' }, 400);

  const apiKey = Deno.env.get('GROQ_API_KEY');
  const model = Deno.env.get('GROQ_MODEL') ?? 'qwen/qwen3.8-27b';
  if (!apiKey) return json({ error: 'Recipe generation is not configured yet. Add GROQ_API_KEY to Supabase secrets.' }, 503);

  const servings = Math.min(Math.max(Number(body.servings) || 2, 1), 8);
  const preferences = Array.isArray(body.preferences)
    ? body.preferences.filter((value): value is string => typeof value === 'string').map((value) => value.trim().slice(0, 60)).filter(Boolean).slice(0, 10)
    : [];
  const allergies = Array.isArray(body.allergies)
    ? body.allergies.filter((value): value is string => typeof value === 'string').map((value) => value.trim().slice(0, 80)).filter(Boolean).slice(0, 20)
    : [];
  const maxCookMinutes = Number(body.maxCookMinutes);
  const budgetLevel = ['budget', 'balanced', 'treat'].includes(String(body.budgetLevel)) ? String(body.budgetLevel) : 'balanced';
  const equipment = Array.isArray(body.equipment)
    ? body.equipment.filter((value): value is string => typeof value === 'string').map((value) => value.trim().slice(0, 40)).filter(Boolean).slice(0, 12)
    : [];
  const skillLevel = ['beginner', 'comfortable', 'advanced'].includes(String(body.skillLevel)) ? String(body.skillLevel) : 'beginner';
  const cookingDaysPerWeek = Math.min(Math.max(Number(body.cookingDaysPerWeek) || 5, 1), 7);
  const swapOut = Array.isArray(body.swapOut) ? body.swapOut.filter((value): value is string => typeof value === 'string').map((value) => value.trim().slice(0, 80)).filter(Boolean).slice(0, 8) : [];
  const swapIn = Array.isArray(body.swapIn) ? body.swapIn.filter((value): value is string => typeof value === 'string').map((value) => value.trim().slice(0, 80)).filter(Boolean).slice(0, 8) : [];
  const rawTargets = body.macroTargets && typeof body.macroTargets === 'object' ? body.macroTargets as Record<string, unknown> : {};
  const macroTargets = {
    calories: Number.isFinite(Number(rawTargets.calories)) && Number(rawTargets.calories) > 0 ? Math.min(10000, Number(rawTargets.calories)) : null,
    proteinGrams: Number.isFinite(Number(rawTargets.proteinGrams)) && Number(rawTargets.proteinGrams) > 0 ? Math.min(1000, Number(rawTargets.proteinGrams)) : null,
    carbsGrams: Number.isFinite(Number(rawTargets.carbsGrams)) && Number(rawTargets.carbsGrams) > 0 ? Math.min(1000, Number(rawTargets.carbsGrams)) : null,
    fatGrams: Number.isFinite(Number(rawTargets.fatGrams)) && Number(rawTargets.fatGrams) > 0 ? Math.min(1000, Number(rawTargets.fatGrams)) : null,
  };
  if (mode === 'MacrosChef' && Object.values(macroTargets).every((value) => value === null)) {
    return json({ error: 'Set at least one nutrition target before using MacrosChef.' }, 400);
  }
  const remix = body.remix && typeof body.remix === 'object' ? body.remix as Record<string, unknown> : null;
  const remixInstruction = typeof remix?.instruction === 'string' ? remix.instruction.trim().slice(0, 500) : '';
  const sourceRecipe = remix?.sourceRecipe && typeof remix.sourceRecipe === 'object' ? remix.sourceRecipe as Record<string, unknown> : null;
  const sourceRecipeTitle = typeof sourceRecipe?.title === 'string' ? sourceRecipe.title.slice(0, 90) : '';
  const sourceIngredients = Array.isArray(sourceRecipe?.ingredients)
    ? sourceRecipe.ingredients.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object').slice(0, 18)
      .map((item) => `${String(item.name ?? '').slice(0, 80)} (${String(item.amount ?? '').slice(0, 40)})`)
    : [];
  const sourceSteps = Array.isArray(sourceRecipe?.steps)
    ? sourceRecipe.steps.filter((step): step is string => typeof step === 'string').slice(0, 8).map((step) => step.slice(0, 500))
    : [];
  const isRemix = Boolean(remixInstruction && sourceRecipeTitle);
  const count = isRemix ? 1 : mode === 'WeeklyPlan' ? cookingDaysPerWeek : Math.min(Math.max(Number(body.count) || 3, 1), 5);
  const hasMacroTargets = Object.values(macroTargets).some((value) => value !== null);
  const modeBrief: Record<string, string> = {
    PantryChef: 'Generate fridge-first meals that use the listed ingredients, reduce food waste, and state any extra grocery items honestly.',
    MasterChef: `Create the requested meal or a close practical version: “${craving}”. Use listed ingredients as substitution opportunities, name anything else needed, and respect the user's time and equipment.`,
    MixologyMaestro: `Create a polished cocktail, mocktail, or drink pairing suited to the ingredients. User request: “${craving || 'surprise me'}”. Include precise liquid measures, glassware, method, garnish, and a non-alcoholic option where sensible.`,
    BakeHeist: `Create a reliable baking recipe suited to the ingredients. User request: “${craving || 'a bake that uses what I have'}”. Baking is precise: give weights in grams, oven temperature in Celsius and Fahrenheit, pan size, visual doneness cues, and proof/rest times where relevant.`,
    MacrosChef: 'Generate meals that prioritize the user’s per-serving macro limits below. Include plausible per-serving estimates and make the recipe practical with available ingredients.',
    WeeklyPlan: `Create a varied seven-day dinner plan for ${cookingDaysPerWeek} cooking days, spaced across the week. Each recipe should be practical, distinct, personalized to preferences and pantry items, and not repeat the same main protein on consecutive cooking days.`,
  };
  const prompt = [
    isRemix ? `Remix the user's existing recipe “${sourceRecipeTitle}” (${Number(sourceRecipe?.timeMinutes) || 30} minutes, ${Number(sourceRecipe?.servings) || servings} servings).` : '',
    isRemix ? `Original ingredients: ${sourceIngredients.join(', ')}.` : '',
    isRemix ? `Original steps: ${sourceSteps.join(' ')}` : '',
    isRemix ? `User's requested change: ${remixInstruction}. Keep the dish recognizable where possible, explain substitutions in the updated ingredients and steps, and do not claim ingredients are safe for allergies unless they are excluded.` : '',
    `Available ingredients: ${ingredients.join(', ') || 'No ingredient list supplied; use practical, commonly available groceries and clearly name them.'}.`,
    modeBrief[mode],
    mode === 'MasterChef' && swapOut.length ? `Avoid these ingredients and replace them: ${swapOut.join(', ')}.${swapIn.length ? ` Prefer these replacements in the same order: ${swapIn.join(', ')}.` : ''} Do not put the ingredients being swapped out back into the recipe.` : '',
    `Make each recipe serve ${servings} people.`,
    preferences.length ? `Dietary preferences: ${preferences.join(', ')}.` : 'No dietary preferences were provided.',
    allergies.length ? `Allergies and ingredients to strictly exclude: ${allergies.join(', ')}. Do not include these in ingredients or directions.` : '',
    Number.isFinite(maxCookMinutes) && maxCookMinutes >= 10 ? `Keep every recipe within ${Math.min(maxCookMinutes, 180)} minutes.` : '',
    `Keep the ingredient cost ${budgetLevel === 'budget' ? 'low and use pantry staples' : budgetLevel === 'treat' ? 'flexible for a special meal' : 'moderate and practical'}.`,
    equipment.length ? `Only use or assume these appliances and equipment: ${equipment.join(', ')}. Do not instruct use of equipment the user does not own.` : 'Assume basic stovetop equipment only; never require a specialty appliance.',
    `Write directions for a ${skillLevel} cook. ${skillLevel === 'beginner' ? 'Explain prep terms, timing, heat level, visual cues, and what to do if something changes.' : skillLevel === 'advanced' ? 'Use concise professional technique and useful temperature cues without over-explaining basic steps.' : 'Give clear steps with useful timing and doneness cues.'}`,
    hasMacroTargets ? `Aim per serving for these nutrition limits: ${macroTargets.calories ? `at most ${macroTargets.calories} kcal` : ''}${macroTargets.proteinGrams ? `; at least ${macroTargets.proteinGrams} g protein` : ''}${macroTargets.carbsGrams ? `; at most ${macroTargets.carbsGrams} g carbohydrates` : ''}${macroTargets.fatGrams ? `; at most ${macroTargets.fatGrams} g fat` : ''}. Include plausible nutritionPerServing values and label them as estimates.` : '',
    isRemix ? 'Return exactly 1 practical remixed recipe.' : `Return exactly ${count} ${mode === 'WeeklyPlan' ? 'distinct dinners, spread across the seven days' : 'distinct recipe'}${count === 1 ? '' : 's'}.`,
    'Basic oil, salt, pepper, and water may be treated as pantry staples; name every other ingredient honestly.',
    'Keep directions clear and safe. Do not make allergy, health, or food-safety guarantees. Nutrition is a rough estimate, never medical advice.',
    hasMacroTargets ? 'Include a plausible rough nutrition estimate per serving so the user can compare it with their targets; make uncertainty clear.' : 'Include a rough nutrition estimate per serving only when there is enough ingredient and amount detail; omit it when uncertain. The app marks nutrition as an estimate.',
    'Return JSON only with this shape: {"recipes":[{"id":"short-kebab-id","title":"...","summary":"...","timeMinutes":20,"servings":2,"difficulty":"Easy","ingredients":[{"name":"...","amount":"..."}],"steps":["..."],"tags":["..."],"tip":"...","nutritionPerServing":{"calories":450,"proteinGrams":22,"carbsGrams":48,"fatGrams":18}}]}.',
  ].join('\n');

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        temperature: 0.85,
        max_tokens: 8192,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'You are Mise, a thoughtful home-cooking assistant. Be creative but practical, reduce food waste, and follow the requested JSON shape exactly.' },
          { role: 'user', content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(35_000),
    });
    if (!response.ok) {
      console.error('Recipe provider returned', response.status);
      return json({ error: 'The recipe kitchen is having a moment. Try again shortly.' }, 502);
    }
    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;
    const decoded = typeof content === 'string' ? JSON.parse(content) : null;
      const recipes = Array.isArray(decoded?.recipes) ? decoded.recipes.slice(0, count) : [];
    if (!recipes.length) return json({ error: 'No recipes came back. Try a different ingredient list.' }, 502);
    return json({ recipes });
  } catch (error) {
    console.error('Meal generation failed', error instanceof Error ? error.message : 'Unknown error');
    return json({ error: 'Could not generate recipes right now. Please try again.' }, 502);
  }
});
