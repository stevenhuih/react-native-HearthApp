import { supabase } from './supabase';

export type PanicStateName = 'empty' | 'sparse' | 'expiring' | 'general';

export interface PanicRecipe {
  recipe_name: string;
  ingredients_used: { name: string; qty?: number; unit?: string }[];
  steps: { n: number; text: string; mins: number }[];
  total_mins: number;
  pans_needed: number;
}

export interface PanicResponse {
  state: PanicStateName;
  honest: boolean;
  message: string | null;
  recipe: PanicRecipe | null;
  recipe_id: string | null;
}

/** Calls the panic-button Edge Function. Rejects on error or 10s timeout (US-003). */
export async function runPanic(): Promise<PanicResponse> {
  const result = await Promise.race([
    supabase.functions.invoke('panic-button', { body: {} }),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 10_000)),
  ]);
  const { data, error } = result as { data: PanicResponse | null; error: unknown };
  if (error || !data) throw new Error('panic_failed');
  return data;
}
