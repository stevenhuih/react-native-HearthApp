// panic-button — Edge Function (architecture §04 + §05, US-003).
//
// State machine: EMPTY (no AI) | SPARSE (<5, honest) | EXPIRING (≤2d) | GENERAL.
// Builds a GPT-4o-mini prompt, then VALIDATES the output against the pantry AND
// the user's allergens. On failure it retries once with a stricter prompt; if
// that still fails it returns an honest response. It NEVER returns a recipe that
// uses an ingredient not in the pantry or that conflicts with an allergen.
//
// Secret (server-side only): OPENAI_API_KEY.

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type PanicState = 'empty' | 'sparse' | 'expiring' | 'general';

interface PantryEntry {
  id: number; // canonical ingredient id
  name: string;
  qty: number | null;
  unit: string;
  allergens: string[];
  expiring: boolean;
}

const RECIPE_UNITS = ['ml', 'g', 'count', 'tbsp', 'tsp', 'cup'];

interface UsedIngredient {
  name: string;
  qty?: number;
  unit?: string;
}

interface Recipe {
  recipe_name: string;
  ingredients_used: UsedIngredient[];
  steps: { n: number; text: string; mins: number }[];
  total_mins: number;
  pans_needed: number;
}

const SPARSE_THRESHOLD = 5;
const HONEST_FALLBACK =
  "Your pantry's a little tricky right now — I couldn't put together a simple, safe meal from what's here. Try scanning a receipt to add a few more ingredients.";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  const a = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const b = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((b - a) / 86_400_000);
}

function fmt(items: PantryEntry[]): string {
  return items
    .map((i) => (i.qty != null ? `${i.name} (${i.qty} ${i.unit})` : i.name))
    .join(', ');
}

const SYSTEM_PROMPT =
  'You are Hearth, a practical kitchen assistant. Your job is to suggest ONE meal for an ' +
  'exhausted person using ONLY the ingredients listed. Hard rules: (1) Max 20 minutes total ' +
  'cook time. (2) Max 1 pan or pot. (3) No more than 5 steps. (4) No technique requiring skill ' +
  'or precise timing — no searing, no emulsifying, no tempering. (5) NEVER suggest any ingredient ' +
  'not in the provided list. (6) If you cannot make a genuinely satisfying meal from these ' +
  'ingredients, return {"honest":true,"message":"<a short honest suggestion>"}. (7) Anchor your ' +
  'recipe to the cuisine style provided. Return JSON only, no markdown. Recipe shape: ' +
  '{"recipe_name":string,"ingredients_used":[{"name":string,"qty":number,"unit":string}],' +
  '"steps":[{"n":number,"text":string,"mins":number}],"total_mins":number,"pans_needed":number}.';

function buildUserPrompt(
  state: PanicState,
  archetype: string,
  restrictions: string[],
  allergens: string[],
  expiring: PantryEntry[],
  others: PantryEntry[],
  all: PantryEntry[]
): string {
  const header =
    `Cuisine style: ${archetype}. ` +
    `Dietary restrictions: ${restrictions.length ? restrictions.join(', ') : 'none'}. ` +
    `Allergens to never use under any circumstances: ${allergens.length ? allergens.join(', ') : 'none'}.`;

  let body: string;
  if (state === 'sparse') {
    body =
      `Your pantry is sparse (only ${all.length} item(s)): ${fmt(all)}. ` +
      `Acknowledge the limited pantry honestly, then give the best simple meal possible using only these.`;
  } else if (state === 'expiring') {
    body = `USE THESE FIRST (expiring soon): ${fmt(expiring)}. Also available: ${fmt(others) || 'none'}.`;
  } else {
    body = `Available ingredients: ${fmt(all)}. Optimise for speed and simplicity.`;
  }
  return `${header} ${body} Return only the JSON described.`;
}

async function callAI(userPrompt: string): Promise<Record<string, unknown> | null> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    console.error('panic: OPENAI_API_KEY is not set');
    return null;
  }
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.4,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`panic: OpenAI ${res.status}: ${body.slice(0, 600)}`);
      return null;
    }
    const data = await res.json();
    return JSON.parse(data.choices?.[0]?.message?.content ?? '{}');
  } catch (e) {
    console.error(`panic: OpenAI fetch threw: ${String(e)}`);
    return null;
  }
}

/** Validate a recipe against the pantry + allergens. Returns the reject reason or null. */
function validate(
  recipe: Recipe,
  pantry: PantryEntry[],
  userAllergens: string[]
): string | null {
  const norm = (s: string) => s.toLowerCase().trim();
  const allergenSet = new Set(userAllergens.map(norm));

  for (const used of recipe.ingredients_used ?? []) {
    const u = norm(used.name ?? '');
    if (!u) return 'an ingredient had no name';
    // Must map to a pantry item (exact or containment either direction).
    const match = pantry.find((p) => {
      const n = norm(p.name);
      return n === u || n.includes(u) || u.includes(n);
    });
    if (!match) return `"${used.name}" is not in the pantry`;
    // Allergen cross-check (rule #7).
    if (match.allergens.some((a) => allergenSet.has(norm(a)))) {
      return `"${used.name}" conflicts with a declared allergen`;
    }
  }
  return null;
}

function matchPantryId(name: string, pantry: PantryEntry[]): number | null {
  const u = name.toLowerCase().trim();
  const m = pantry.find((p) => {
    const n = p.name.toLowerCase();
    return n === u || n.includes(u) || u.includes(n);
  });
  return m ? m.id : null;
}

/** Persist a validated Panic recipe (ai_generated) so it can be cooked. Returns
 *  recipe_id, or null on failure (cooking is then unavailable but the suggestion
 *  still shows). Ingredient names already map to pantry items (validated above). */
async function persistRecipe(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  recipe: Recipe,
  pantry: PantryEntry[]
): Promise<string | null> {
  try {
    const { data: rec, error } = await supabase
      .from('recipes')
      .insert({
        created_by: userId,
        title: recipe.recipe_name,
        source_type: 'ai_generated',
        instructions: recipe.steps,
        cook_time_mins: recipe.total_mins ?? null,
        servings: 1,
        is_community: false,
      })
      .select('id')
      .single();
    if (error || !rec) return null;

    const seen = new Set<number>();
    const rows: { recipe_id: string; ingredient_id: number; quantity: number | null; unit: string | null }[] = [];
    for (const used of recipe.ingredients_used ?? []) {
      const id = matchPantryId(used.name, pantry);
      if (id == null || seen.has(id)) continue;
      seen.add(id);
      rows.push({
        recipe_id: rec.id as string,
        ingredient_id: id,
        quantity: typeof used.qty === 'number' ? used.qty : null,
        unit: used.unit && RECIPE_UNITS.includes(used.unit) ? used.unit : null,
      });
    }
    if (rows.length > 0) await supabase.from('recipe_ingredients').insert(rows);
    return rec.id as string;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'unauthorized' }, 401);

    // User-scoped client so RLS applies to pantry/profile reads.
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userErr || !user) return json({ error: 'unauthorized' }, 401);

    // Pantry (active) with allergen tags.
    const { data: rawItems } = await supabase
      .from('pantry_items')
      .select('quantity, expires_at, ingredient:ingredients(id, name, default_unit, allergens)')
      .eq('status', 'active');

    const pantry: PantryEntry[] = (rawItems ?? [])
      .filter((r: { ingredient: unknown }) => r.ingredient)
      .map((r: {
        quantity: number | null;
        expires_at: string | null;
        ingredient: { id: number; name: string; default_unit: string; allergens: string[] | null };
      }) => {
        const d = daysUntil(r.expires_at);
        return {
          id: r.ingredient.id,
          name: r.ingredient.name,
          qty: r.quantity,
          unit: r.ingredient.default_unit,
          allergens: r.ingredient.allergens ?? [],
          expiring: d !== null && d <= 2,
        };
      });

    // EMPTY — no AI.
    if (pantry.length === 0) {
      return json({
        state: 'empty',
        honest: true,
        message: 'Scan a receipt to unlock the Panic Button.',
        recipe: null,
        recipe_id: null,
      });
    }

    // Profile: cuisine anchor + dietary constraints.
    const { data: profile } = await supabase
      .from('users')
      .select('archetype_id, dietary_profile')
      .eq('id', user.id)
      .single();
    let archetype = 'simple home cooking';
    if (profile?.archetype_id) {
      const { data: arch } = await supabase
        .from('pantry_archetypes')
        .select('name')
        .eq('id', profile.archetype_id)
        .single();
      if (arch?.name) archetype = arch.name;
    }
    const allergens: string[] = profile?.dietary_profile?.allergens ?? [];
    const restrictions: string[] = profile?.dietary_profile?.restrictions ?? [];

    // State.
    const expiring = pantry.filter((p) => p.expiring);
    const others = pantry.filter((p) => !p.expiring);
    const state: PanicState =
      pantry.length < SPARSE_THRESHOLD ? 'sparse' : expiring.length > 0 ? 'expiring' : 'general';

    // Build prompt → AI → validate → retry once stricter → honest fallback.
    let userPrompt = buildUserPrompt(state, archetype, restrictions, allergens, expiring, others, pantry);

    for (let attempt = 0; attempt < 2; attempt++) {
      const parsed = await callAI(userPrompt);
      if (!parsed) return json({ error: 'ai_unavailable' }, 502);

      // AI's own honest response (rule 6).
      if (parsed.honest === true || !parsed.recipe_name) {
        return json({
          state,
          honest: true,
          message: typeof parsed.message === 'string' ? parsed.message : HONEST_FALLBACK,
          recipe: null,
          recipe_id: null,
        });
      }

      const recipe = parsed as unknown as Recipe;
      const reason = validate(recipe, pantry, allergens);
      if (!reason) {
        const recipeId = await persistRecipe(supabase, user.id, recipe, pantry);
        return json({ state, honest: state === 'sparse', message: null, recipe, recipe_id: recipeId });
      }

      // Stricter retry prompt for the second attempt only.
      userPrompt =
        buildUserPrompt(state, archetype, restrictions, allergens, expiring, others, pantry) +
        ` IMPORTANT: your previous answer was rejected because ${reason}. ` +
        `Use ONLY these exact ingredients: ${pantry.map((p) => p.name).join(', ')}. ` +
        `Never use any allergen: ${allergens.length ? allergens.join(', ') : 'none'}.`;
    }

    // Retry failed → honest, never a bad recipe.
    return json({ state, honest: true, message: HONEST_FALLBACK, recipe: null, recipe_id: null });
  } catch {
    return json({ error: 'internal' }, 500);
  }
});
