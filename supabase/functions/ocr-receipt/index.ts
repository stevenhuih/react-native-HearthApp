// ocr-receipt — Edge Function (architecture §04).
//
// Flow: base64 image -> Google Vision (DOCUMENT_TEXT_DETECTION) -> parse lines ->
// strip brands -> canonical alias match -> GPT-4o-mini fallback (batched) for the
// rest -> silently drop unmatched -> return items for confirmation (NO insert here).
//
// Secrets (server-side only — never in the client):
//   GOOGLE_VISION_API_KEY  (required)
//   OPENAI_API_KEY         (optional; without it, unmatched items are just dropped)
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected by the platform.

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface CanonicalIngredient {
  id: number;
  name: string;
  aliases: string[];
  default_unit: string;
  default_quantity: number | null;
  default_shelf_life_days: number | null;
}

interface ParsedLine {
  name: string;
  quantity: number | null;
  unit: string | null; // normalized to g | ml | count | null
}

// Starter brand keyword list (Latin + CJK). // TODO: expand from real receipts.
const BRAND_TOKENS = [
  'kikkoman', 'lee kum kee', 'lkk', 'maggi', 'prima', 'prima taste', 'knorr', 'nestle',
  'ayam brand', 'del monte', 'heinz', 'kraft', 'meadow', 'marigold', 'farmhouse',
  'cp', 'woh hup', 'tean', "tean's", 'gold', 'panda',
  '李錦記', '萬字', 'キッコーマン', '味の素',
];

// Lines that are clearly not products.
const SKIP_KEYWORDS = [
  'total', 'subtotal', 'sub-total', 'gst', 'tax', 'cash', 'change', 'visa', 'master',
  'card', 'balance', 'qty', 'receipt', 'invoice', 'thank', 'cashier', 'tel', 'rounding',
  'discount', 'voucher', 'points', 'member',
];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isoAddDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Heuristic line parser: drop prices/SKUs/non-product lines, pull qty + unit. */
function parseReceiptLines(text: string): ParsedLine[] {
  const out: ParsedLine[] = [];
  for (const raw of text.split('\n')) {
    let line = raw.trim();
    if (line.length < 2) continue;

    const lower = line.toLowerCase();
    if (SKIP_KEYWORDS.some((k) => lower.includes(k))) continue;

    // Extract weight/volume (e.g. 450g, 1.2kg, 500ml, 1L), normalize to g / ml.
    let quantity: number | null = null;
    let unit: string | null = null;
    const m = line.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l)\b/i);
    if (m) {
      const value = parseFloat(m[1].replace(',', '.'));
      const u = m[2].toLowerCase();
      if (u === 'kg') {
        quantity = value * 1000;
        unit = 'g';
      } else if (u === 'g') {
        quantity = value;
        unit = 'g';
      } else if (u === 'l') {
        quantity = value * 1000;
        unit = 'ml';
      } else {
        quantity = value;
        unit = 'ml';
      }
    }

    // Strip prices, trailing tax flags, leading SKU/barcode digit runs, the qty token.
    let name = line
      .replace(/\$?\d+[.,]\d{2}\b\s*[a-z*#]?$/i, '') // trailing price
      .replace(/\b\d{6,}\b/g, '') // long SKU/barcode
      .replace(/\d+(?:[.,]\d+)?\s*(kg|g|ml|l)\b/i, '') // the qty token
      .replace(/\bx?\s*\d+\s*x\b/i, '') // multipliers like "2x"
      .replace(/[*#]/g, '')
      .trim();

    // Drop anything left that's just numbers/symbols.
    if (!/[a-z　-鿿]/i.test(name)) continue;
    name = name.replace(/\s{2,}/g, ' ').trim();
    if (name.length < 2) continue;

    out.push({ name, quantity, unit });
  }
  return out;
}

/** Remove brand tokens from a candidate product name. */
function stripBrands(name: string): string {
  let cleaned = ` ${name.toLowerCase()} `;
  for (const brand of BRAND_TOKENS) {
    cleaned = cleaned.split(brand.toLowerCase()).join(' ');
  }
  return cleaned.replace(/\s{2,}/g, ' ').trim();
}

/** Exact canonical match on name or an alias; falls back to whole-name containment. */
function matchAlias(cleaned: string, list: CanonicalIngredient[]): CanonicalIngredient | null {
  const c = cleaned.toLowerCase().trim();
  if (!c) return null;
  for (const ing of list) {
    if (ing.name.toLowerCase() === c) return ing;
    if (ing.aliases?.some((a) => a.toLowerCase() === c)) return ing;
  }
  // Secondary: the canonical name (or alias) appears as a word in the cleaned text.
  for (const ing of list) {
    const candidates = [ing.name, ...(ing.aliases ?? [])].map((s) => s.toLowerCase());
    if (candidates.some((cand) => new RegExp(`\\b${escapeRe(cand)}\\b`).test(c))) return ing;
  }
  return null;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Batched GPT-4o-mini classification of leftover items -> ingredient_id | null. */
async function classifyWithAI(
  candidates: string[],
  list: CanonicalIngredient[]
): Promise<(number | null)[]> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey || candidates.length === 0) return candidates.map(() => null);

  const catalog = list.map((l) => `${l.id}: ${l.name}`).join('\n');
  const system =
    'You map grocery receipt line items to a single canonical ingredient id from the provided catalog. ' +
    'Use the closest canonical ingredient. If an item is a ready-made/prepared product or does not clearly ' +
    'match any catalog ingredient, return null for it. Return JSON only.';
  const userMsg =
    `Catalog (id: name):\n${catalog}\n\n` +
    `Items (0-indexed):\n${candidates.map((c, i) => `${i}: ${c}`).join('\n')}\n\n` +
    `Return: {"results":[{"i":<index>,"id":<ingredient_id or null>}]}`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userMsg },
        ],
      }),
    });
    if (!res.ok) return candidates.map(() => null);
    const data = await res.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? '{}');
    const validIds = new Set(list.map((l) => l.id));
    const result: (number | null)[] = candidates.map(() => null);
    for (const r of parsed.results ?? []) {
      if (typeof r.i === 'number' && r.i >= 0 && r.i < candidates.length) {
        result[r.i] = typeof r.id === 'number' && validIds.has(r.id) ? r.id : null;
      }
    }
    return result;
  } catch {
    return candidates.map(() => null);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    // 1. Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'unauthorized' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userErr || !user) return json({ error: 'unauthorized' }, 401);

    const { image_base64 } = await req.json().catch(() => ({}));
    if (!image_base64 || typeof image_base64 !== 'string') {
      return json({ error: 'missing_image' }, 400);
    }

    const visionKey = Deno.env.get('GOOGLE_VISION_API_KEY');
    if (!visionKey) return json({ error: 'server_misconfigured' }, 500);

    // 2. Google Vision OCR (CJK-aware via languageHints).
    const visionRes = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${visionKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [
            {
              image: { content: image_base64 },
              features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
              imageContext: { languageHints: ['en', 'ja', 'zh-Hans', 'zh-Hant'] },
            },
          ],
        }),
      }
    );
    if (!visionRes.ok) {
      const body = await visionRes.text();
      console.error(`ocr: Vision ${visionRes.status}: ${body.slice(0, 600)}`);
      return json({ error: 'vision_failed' }, 502);
    }
    const visionJson = await visionRes.json();
    const text: string = visionJson?.responses?.[0]?.fullTextAnnotation?.text ?? '';
    if (!text.trim()) return json({ error: 'unreadable' }, 422);

    // 3. Parse product lines.
    const parsed = parseReceiptLines(text);
    if (parsed.length === 0) return json({ error: 'unreadable' }, 422);

    // 5. Load canonical ingredients (public/read-only).
    const { data: ingredients, error: ingErr } = await supabase
      .from('ingredients')
      .select('id, name, aliases, default_unit, default_quantity, default_shelf_life_days');
    if (ingErr) return json({ error: 'internal' }, 500);
    const list = (ingredients ?? []) as CanonicalIngredient[];

    // 4 + 5. Brand strip then alias match.
    const matched: { ingredient: CanonicalIngredient; parsed: ParsedLine }[] = [];
    const leftover: { cleaned: string; parsed: ParsedLine }[] = [];
    for (const p of parsed) {
      const cleaned = stripBrands(p.name);
      const m = matchAlias(cleaned, list);
      if (m) matched.push({ ingredient: m, parsed: p });
      else leftover.push({ cleaned, parsed: p });
    }

    // 6. GPT-4o-mini fallback for the rest (batched, one call).
    if (leftover.length > 0) {
      const ids = await classifyWithAI(
        leftover.map((l) => l.cleaned),
        list
      );
      leftover.forEach((l, i) => {
        const ing = ids[i] != null ? list.find((x) => x.id === ids[i]) : null;
        if (ing) matched.push({ ingredient: ing, parsed: l.parsed }); // 7. else silently dropped
      });
    }

    const droppedCount = parsed.length - matched.length;

    // 8 + 9. Build the confirmation payload (stock units; no INSERT here).
    const items = matched.map(({ ingredient, parsed }) => {
      const useParsedQty = parsed.unit != null && parsed.unit === ingredient.default_unit;
      return {
        ingredient_id: ingredient.id,
        name: ingredient.name,
        quantity: useParsedQty ? parsed.quantity : ingredient.default_quantity,
        unit: ingredient.default_unit,
        expires_at:
          ingredient.default_shelf_life_days != null
            ? isoAddDays(ingredient.default_shelf_life_days)
            : null,
      };
    });

    return json({ items, dropped_count: droppedCount }, 200);
  } catch {
    return json({ error: 'internal' }, 500);
  }
});
