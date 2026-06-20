import { create } from 'zustand';

import {
  fetchPantryItems,
  insertPantryItem,
  markUsed,
  patchPantryItem,
  removePantryItem,
  touchStillHave,
} from '@/lib/pantry';
import { fetchAllIngredients } from '@/lib/ingredients';
import type { Ingredient, PantryItem } from '@/types/db';

const GENERIC_ERROR = 'Something went wrong. Please try again.';

// Soonest-to-expire first; items without a date sink to the bottom.
function sortItems(items: PantryItem[]): PantryItem[] {
  return [...items].sort((a, b) => {
    if (a.expires_at === b.expires_at) return 0;
    if (!a.expires_at) return 1;
    if (!b.expires_at) return -1;
    return a.expires_at < b.expires_at ? -1 : 1;
  });
}

interface PantryState {
  items: PantryItem[];
  ingredients: Ingredient[];
  isLoading: boolean;
  error: string | null;

  loadAll: () => Promise<void>;
  ensureIngredients: () => Promise<void>;
  addItem: (ingredient: Ingredient, quantity: number | null, expiresAt: string | null) => Promise<void>;
  markUsedOptimistic: (id: string) => Promise<void>;
  stillHaveItOptimistic: (id: string) => Promise<void>;
  editItem: (id: string, patch: { quantity?: number | null; expires_at?: string | null }) => Promise<void>;
  removeItemOptimistic: (id: string) => Promise<void>;
  dismissError: () => void;
}

let tempCounter = 0;

export const usePantryStore = create<PantryState>((set, get) => ({
  items: [],
  ingredients: [],
  isLoading: false,
  error: null,

  loadAll: async () => {
    set({ isLoading: true, error: null });
    try {
      const [items, ingredients] = await Promise.all([fetchPantryItems(), fetchAllIngredients()]);
      set({ items: sortItems(items), ingredients, isLoading: false });
    } catch {
      set({ isLoading: false, error: "We couldn't load your pantry. Pull to refresh or check your connection." });
    }
  },

  ensureIngredients: async () => {
    if (get().ingredients.length > 0) return;
    try {
      set({ ingredients: await fetchAllIngredients() });
    } catch {
      /* surfaced as an empty Add Item state */
    }
  },

  // Optimistic add: show a temp row immediately, then swap in the real row.
  addItem: async (ingredient, quantity, expiresAt) => {
    const tempId = `temp-${++tempCounter}`;
    const optimistic: PantryItem = {
      id: tempId,
      user_id: '',
      household_id: null,
      ingredient_id: ingredient.id,
      quantity,
      expires_at: expiresAt,
      add_method: 'manual',
      status: 'active',
      updated_at: new Date().toISOString(),
      ingredient: {
        id: ingredient.id,
        name: ingredient.name,
        category: ingredient.category,
        default_unit: ingredient.default_unit,
        track_quantity: ingredient.track_quantity,
      },
    };
    set({ items: sortItems([...get().items, optimistic]) });

    try {
      const saved = await insertPantryItem({ ingredient_id: ingredient.id, quantity, expires_at: expiresAt });
      set({ items: sortItems(get().items.map((it) => (it.id === tempId ? saved : it))) });
    } catch {
      set({ items: get().items.filter((it) => it.id !== tempId), error: GENERIC_ERROR });
    }
  },

  markUsedOptimistic: async (id) => {
    const snapshot = get().items;
    set({ items: snapshot.filter((it) => it.id !== id) });
    try {
      await markUsed(id);
    } catch {
      set({ items: snapshot, error: GENERIC_ERROR });
    }
  },

  stillHaveItOptimistic: async (id) => {
    const snapshot = get().items;
    set({
      items: get().items.map((it) =>
        it.id === id ? { ...it, updated_at: new Date().toISOString() } : it
      ),
    });
    try {
      await touchStillHave(id);
    } catch {
      set({ items: snapshot, error: GENERIC_ERROR });
    }
  },

  editItem: async (id, patch) => {
    const snapshot = get().items;
    set({ items: sortItems(get().items.map((it) => (it.id === id ? { ...it, ...patch } : it))) });
    try {
      await patchPantryItem(id, patch);
    } catch {
      set({ items: snapshot, error: GENERIC_ERROR });
    }
  },

  removeItemOptimistic: async (id) => {
    const snapshot = get().items;
    set({ items: snapshot.filter((it) => it.id !== id) });
    try {
      await removePantryItem(id);
    } catch {
      set({ items: snapshot, error: GENERIC_ERROR });
    }
  },

  dismissError: () => set({ error: null }),
}));
