import { supabase } from './supabase';

export interface ImportedIngredient {
  name: string;
  have: boolean;
}

export interface ImportResult {
  recipe_id: string;
  title: string;
  cook_time_mins: number | null;
  steps: { n: number; text: string }[];
  ingredients: ImportedIngredient[];
  have: number;
  total: number;
  match_pct: number;
}

export type ImportErrorKind = 'no_recipe' | 'unsupported' | 'generic';

export class ImportError extends Error {
  kind: ImportErrorKind;
  constructor(kind: ImportErrorKind) {
    super(kind);
    this.kind = kind;
  }
}

/** Calls the import-recipe Edge Function. Throws ImportError on failure. */
export async function importRecipe(url: string): Promise<ImportResult> {
  const { data, error } = await supabase.functions.invoke('import-recipe', { body: { url } });
  if (error) throw await toImportError(error);
  return data as ImportResult;
}

async function toImportError(error: unknown): Promise<ImportError> {
  try {
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      const body = await ctx.json();
      if (body?.error === 'no_recipe') return new ImportError('no_recipe');
      if (body?.error === 'unsupported_url' || body?.error === 'invalid_url') {
        return new ImportError('unsupported');
      }
    }
  } catch {
    /* fall through */
  }
  return new ImportError('generic');
}
