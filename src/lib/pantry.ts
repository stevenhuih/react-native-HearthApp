import { supabase } from './supabase';
import type { PantryItem } from '@/types/db';

// Embed the canonical ingredient on every pantry row (PostgREST join). The
// pantry NEVER stores a name/brand — only ingredient_id — so display names come
// from this join (AGENTS.md rule #1).
const PANTRY_SELECT =
  '*, ingredient:ingredients(id, name, category, default_unit, track_quantity)';

/** Active pantry items for the current user, soonest-to-expire first. */
export async function fetchPantryItems(): Promise<PantryItem[]> {
  const { data, error } = await supabase
    .from('pantry_items')
    .select(PANTRY_SELECT)
    .eq('status', 'active')
    .order('expires_at', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as unknown as PantryItem[];
}

export interface InsertPantryInput {
  ingredient_id: number;
  quantity: number | null;
  expires_at: string | null;
}

/** Insert a manually-added pantry item and return the joined row. */
export async function insertPantryItem(input: InsertPantryInput): Promise<PantryItem> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated.');

  const { data, error } = await supabase
    .from('pantry_items')
    .insert({
      user_id: user.id,
      added_by: user.id,
      ingredient_id: input.ingredient_id,
      quantity: input.quantity,
      expires_at: input.expires_at,
      add_method: 'manual',
    })
    .select(PANTRY_SELECT)
    .single();
  if (error) throw error;
  return data as unknown as PantryItem;
}

export interface BatchPantryRow {
  ingredient_id: number;
  quantity: number | null;
  expires_at: string | null;
}

/** Batch-insert confirmed receipt items (add_method = 'receipt'). RLS requires
 *  user_id = auth.uid() on every row. */
export async function insertPantryItemsBatch(rows: BatchPantryRow[]): Promise<void> {
  if (rows.length === 0) return;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated.');

  const payload = rows.map((r) => ({
    user_id: user.id,
    added_by: user.id,
    ingredient_id: r.ingredient_id,
    quantity: r.quantity,
    expires_at: r.expires_at,
    add_method: 'receipt' as const,
  }));
  const { error } = await supabase.from('pantry_items').insert(payload);
  if (error) throw error;
}

/** Swipe left → mark used (depleted). */
export async function markUsed(id: string): Promise<void> {
  const { error } = await supabase.from('pantry_items').update({ status: 'used' }).eq('id', id);
  if (error) throw error;
}

/** Swipe right → "still have it": no value change, but the BEFORE UPDATE trigger
 *  bumps updated_at so the item is treated as freshly confirmed. */
export async function touchStillHave(id: string): Promise<void> {
  const { error } = await supabase.from('pantry_items').update({ status: 'active' }).eq('id', id);
  if (error) throw error;
}

/** Item Detail edits (quantity / expiry). */
export async function patchPantryItem(
  id: string,
  patch: { quantity?: number | null; expires_at?: string | null }
): Promise<void> {
  const { error } = await supabase.from('pantry_items').update(patch).eq('id', id);
  if (error) throw error;
}

/** Remove from the pantry (soft delete via status). */
export async function removePantryItem(id: string): Promise<void> {
  const { error } = await supabase.from('pantry_items').update({ status: 'removed' }).eq('id', id);
  if (error) throw error;
}
