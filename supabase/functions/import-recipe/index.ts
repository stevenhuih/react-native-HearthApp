// import-recipe — Edge Function (architecture §04 + §05, US-004).
//
// Two-layer pipeline, cheap first:
//   1. Caption layer (free): fetch the page, read og: meta + schema.org JSON-LD.
//   2. GPT-4o-mini structures the caption. If incomplete →
//   3. Whisper fallback (best-effort): transcribe a discoverable media URL.
// Then map ingredients to canonical ids (drop unmappable), cross-check the
// pantry, persist recipe + recipe_ingredients + saved_recipes, and return.
//
// Secret (server-side only): OPENAI_API_KEY (used for GPT + Whisper).

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ALLOWED_UNITS = ['ml', 'g', 'count', 'tbsp', 'tsp', 'cup'];
const WHISPER_MAX_BYTES = 24 * 1024 * 1024;
const NL = String.fromCharCode(10);

interface CanonicalIngredient {
  id: number;
  name: string;
  aliases: string[];
}

interface ExtractedRecipe {
  recipe_name: string;
  ingredients: { name: string; qty: number | null; unit: string | null }[];
  steps: { n: number; text: string }[];
  cook_time_mins: number | null;
  servings: number | null;
  macros: Record<string, number> | null;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function platformFromUrl(url: string): 'tiktok' | 'youtube' | 'instagram' | 'web' {
  const u = url.toLowerCase();
  if (u.includes('tiktok.')) return 'tiktok';
  if (u.includes('youtube.') || u.includes('youtu.be')) return 'youtube';
  if (u.includes('instagram.')) return 'instagram';
  return 'web';
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

/** Read a meta tag's content, tolerating attribute order. (Meta keys contain no
 *  regex-special characters, so they are used in the pattern verbatim.) */
function getMeta(html: string, key: string): string | null {
  const Q = '[' + String.fromCharCode(34) + String.fromCharCode(39) + ']'; // ["']
  const NQ = '[^' + String.fromCharCode(34) + String.fromCharCode(39) + ']'; // [^"']
  const patterns = [
    new RegExp('<meta[^>]+(?:property|name)=' + Q + key + Q + '[^>]+content=' + Q + '(' + NQ + '*)' + Q, 'i'),
    new RegExp('<meta[^>]+content=' + Q + '(' + NQ + '*)' + Q + '[^>]+(?:property|name)=' + Q + key + Q, 'i'),
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m) return decodeEntities(m[1]);
  }
  return null;
}

/** Pull a schema.org Recipe out of any JSON-LD blocks (indexOf-based, no regex). */
function findJsonLdRecipe(html: string): string | null {
  let idx = 0;
  for (;;) {
    const start = html.indexOf('<script', idx);
    if (start === -1) break;
    const tagEnd = html.indexOf('>', start);
    if (tagEnd === -1) break;
    const tag = html.slice(start, tagEnd);
    const close = html.indexOf('</script>', tagEnd);
    if (close === -1) break;
    idx = close + 9;
    if (!tag.includes('application/ld+json')) continue;

    const raw = html.slice(tagEnd + 1, close).trim();
    try {
      const parsed = JSON.parse(raw);
      const nodes = Array.isArray(parsed) ? parsed : parsed['@graph'] ?? [parsed];
      for (const node of nodes) {
        const type = node?.['@type'];
        const isRecipe = type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe'));
        if (isRecipe) return JSON.stringify(node).slice(0, 6000);
      }
    } catch {
      /* skip malformed block */
    }
  }
  return null;
}

interface PageData {
  text: string;
  videoUrl: string | null;
}

async function fetchPage(url: string): Promise<PageData | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
      },
    });
    if (!res.ok) return null;
    const html = await res.text();

    const jsonLd = findJsonLdRecipe(html);
    const title = getMeta(html, 'og:title') ?? '';
    const desc = getMeta(html, 'og:description') ?? getMeta(html, 'twitter:description') ?? '';
    const videoUrl =
      getMeta(html, 'og:video:url') ?? getMeta(html, 'og:video') ?? getMeta(html, 'og:audio:url');

    const text = jsonLd ?? (title + '. ' + desc).trim();
    return { text, videoUrl };
  } catch {
    return null;
  }
}

const STRUCT_SYSTEM =
  'You extract a single cooking recipe from text. If the text contains a reasonably complete recipe ' +
  '(at least an ingredient list), return {"complete":true,"recipe":{...}}. Otherwise return {"complete":false}. ' +
  'Recipe shape: {"recipe_name":string,"ingredients":[{"name":string,"qty":number|null,"unit":string|null}],' +
  '"steps":[{"n":number,"text":string}],"cook_time_mins":number|null,"servings":number|null,' +
  '"macros":{"calories":number,"protein_g":number,"carbs_g":number,"fat_g":number}|null}. ' +
  'Use null for unknown numeric fields. Return JSON only, no markdown.';

async function structure(text: string): Promise<ExtractedRecipe | null> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey || !text.trim()) return null;
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: STRUCT_SYSTEM },
          { role: 'user', content: text.slice(0, 8000) },
        ],
      }),
    });
    if (!res.ok) {
      console.error('import: structure ' + res.status + ': ' + (await res.text()).slice(0, 400));
      return null;
    }
    const data = await res.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? '{}');
    if (parsed.complete === true && parsed.recipe?.recipe_name) return parsed.recipe as ExtractedRecipe;
    return null;
  } catch (e) {
    console.error('import: structure threw ' + String(e));
    return null;
  }
}

/** Best-effort Whisper transcription of a discoverable media URL. */
async function transcribe(mediaUrl: string): Promise<string | null> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) return null;
  try {
    const mediaRes = await fetch(mediaUrl);
    if (!mediaRes.ok) return null;
    const blob = await mediaRes.blob();
    if (blob.size === 0 || blob.size > WHISPER_MAX_BYTES) return null;

    const form = new FormData();
    form.append('file', blob, 'audio.mp4');
    form.append('model', 'whisper-1');
    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + apiKey },
      body: form,
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.text === 'string' ? data.text : null;
  } catch {
    return null;
  }
}

/** Map ingredient names to canonical ids: alias-match first, then GPT-4o-mini. */
async function mapToCanonical(
  names: string[],
  list: CanonicalIngredient[]
): Promise<(number | null)[]> {
  const norm = (s: string) => s.toLowerCase().trim();
  const result: (number | null)[] = names.map(() => null);
  const leftover: { i: number; name: string }[] = [];

  names.forEach((raw, i) => {
    const n = norm(raw);
    const hit = list.find(
      (ing) =>
        norm(ing.name) === n || ing.aliases?.some((a) => norm(a) === n) || n.includes(norm(ing.name))
    );
    if (hit) result[i] = hit.id;
    else leftover.push({ i, name: raw });
  });

  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (leftover.length === 0 || !apiKey) return result;

  try {
    const catalog = list.map((l) => l.id + ': ' + l.name).join(NL);
    const items = leftover.map((l, k) => k + ': ' + l.name).join(NL);
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'Map each recipe ingredient to the closest canonical ingredient id, or null if none ' +
              'fits. Return {"results":[{"i":index,"id":id_or_null}]}. JSON only.',
          },
          { role: 'user', content: 'Catalog:' + NL + catalog + NL + NL + 'Items:' + NL + items },
        ],
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? '{}');
      const valid = new Set(list.map((l) => l.id));
      for (const r of parsed.results ?? []) {
        if (typeof r.i === 'number' && leftover[r.i]) {
          result[leftover[r.i].i] = typeof r.id === 'number' && valid.has(r.id) ? r.id : null;
        }
      }
    }
  } catch {
    /* leave unmapped as null */
  }
  return result;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'unauthorized' }, 401);

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

    const { url } = await req.json().catch(() => ({}));
    const lower = typeof url === 'string' ? url.toLowerCase() : '';
    if (!url || (!lower.startsWith('http://') && !lower.startsWith('https://'))) {
      return json({ error: 'invalid_url' }, 400);
    }

    // 1–2. Caption layer.
    const page = await fetchPage(url);
    if (!page) return json({ error: 'unsupported_url' }, 422);

    // 3. Structure from caption.
    let recipe = await structure(page.text);

    // 4. Whisper fallback (only if caption was incomplete and a media URL exists).
    if (!recipe && page.videoUrl) {
      const transcript = await transcribe(page.videoUrl);
      if (transcript) recipe = await structure(transcript);
    }

    if (!recipe) return json({ error: 'no_recipe' }, 422);

    // 5. Canonical mapping (drop unmappable — no free text).
    const { data: ingRows } = await supabase.from('ingredients').select('id, name, aliases');
    const list = (ingRows ?? []) as CanonicalIngredient[];
    const ids = await mapToCanonical(recipe.ingredients.map((i) => i.name), list);

    const recipeIngredients = recipe.ingredients
      .map((ing, i) => ({
        ingredient_id: ids[i],
        name: list.find((l) => l.id === ids[i])?.name ?? ing.name,
        quantity: ing.qty,
        unit: ing.unit && ALLOWED_UNITS.includes(ing.unit) ? ing.unit : null,
      }))
      .filter(
        (r): r is { ingredient_id: number; name: string; quantity: number | null; unit: string | null } =>
          r.ingredient_id != null
      );

    // 6. Pantry cross-check.
    const { data: pantryRows } = await supabase
      .from('pantry_items')
      .select('ingredient_id')
      .eq('status', 'active');
    const pantrySet = new Set((pantryRows ?? []).map((p: { ingredient_id: number }) => p.ingredient_id));
    const total = recipeIngredients.length;
    const have = recipeIngredients.filter((r) => pantrySet.has(r.ingredient_id)).length;
    const missing = recipeIngredients
      .filter((r) => !pantrySet.has(r.ingredient_id))
      .map((r) => r.ingredient_id);
    const matchPct = total > 0 ? Math.round((have / total) * 100) : 0;

    // 7. Persist recipe + ingredients + saved_recipes (RLS-scoped to the user).
    const { data: savedRecipe, error: recErr } = await supabase
      .from('recipes')
      .insert({
        created_by: user.id,
        title: recipe.recipe_name,
        source_url: url,
        source_type: platformFromUrl(url),
        instructions: recipe.steps,
        cook_time_mins: recipe.cook_time_mins,
        servings: recipe.servings ?? 1,
        macros_per_serving: recipe.macros,
        is_community: false,
      })
      .select('id')
      .single();
    if (recErr || !savedRecipe) return json({ error: 'internal' }, 500);

    if (recipeIngredients.length > 0) {
      await supabase.from('recipe_ingredients').insert(
        recipeIngredients.map((r) => ({
          recipe_id: savedRecipe.id,
          ingredient_id: r.ingredient_id,
          quantity: r.quantity,
          unit: r.unit,
        }))
      );
    }

    await supabase.from('saved_recipes').insert({
      user_id: user.id,
      recipe_id: savedRecipe.id,
      pantry_match_pct: matchPct,
      missing_ingredients: missing,
    });

    // 8. Return for the import result screen.
    return json({
      recipe_id: savedRecipe.id,
      title: recipe.recipe_name,
      cook_time_mins: recipe.cook_time_mins,
      steps: recipe.steps,
      ingredients: recipeIngredients.map((r) => ({ name: r.name, have: pantrySet.has(r.ingredient_id) })),
      have,
      total,
      match_pct: matchPct,
    });
  } catch {
    return json({ error: 'internal' }, 500);
  }
});
