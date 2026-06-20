import type { RealtimeChannel } from '@supabase/supabase-js';
import { create } from 'zustand';

import { fetchSavedRecipes } from '@/lib/saved';
import { supabase } from '@/lib/supabase';
import type { SavedRecipeCard } from '@/types/db';

// Highest pantry match first; ties (and the empty-pantry 0% case) fall back to
// recency. Mirrors the server-side order so the initial fetch and live patches agree.
function sortSaved(rows: SavedRecipeCard[]): SavedRecipeCard[] {
  return [...rows].sort((a, b) => {
    const pa = a.pantry_match_pct ?? 0;
    const pb = b.pantry_match_pct ?? 0;
    if (pa !== pb) return pb - pa;
    return a.saved_at < b.saved_at ? 1 : -1;
  });
}

interface ExploreState {
  saved: SavedRecipeCard[];
  isLoading: boolean;
  error: string | null;
  channel: RealtimeChannel | null;

  load: () => Promise<void>;
  subscribe: () => Promise<void>;
  unsubscribe: () => void;
}

export const useExploreStore = create<ExploreState>((set, get) => ({
  saved: [],
  isLoading: false,
  error: null,
  channel: null,

  load: async () => {
    set({ isLoading: true, error: null });
    try {
      const rows = await fetchSavedRecipes();
      set({ saved: sortSaved(rows), isLoading: false });
    } catch {
      set({
        isLoading: false,
        error: "We couldn't load your saved recipes. Pull to refresh or check your connection.",
      });
    }
  },

  // Live re-sort (US-008): the pantry-change trigger (0016) updates
  // collections.pantry_match_pct, and Realtime streams it here. RLS +
  // user_id filter scope this to the signed-in user's own rows.
  subscribe: async () => {
    if (get().channel) return;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) return;

    const channel = supabase
      .channel('collections_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'collections', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as { id?: string }).id;
            if (oldId) set({ saved: get().saved.filter((s) => s.id !== oldId) });
            return;
          }
          const row = payload.new as {
            id: string;
            pantry_match_pct: number | null;
            missing_ingredients: number[] | null;
          };
          const known = get().saved.some((s) => s.id === row.id);
          if (!known) {
            // A recipe saved elsewhere — refetch to pick up the joined title/cook time.
            get().load();
            return;
          }
          set({
            saved: sortSaved(
              get().saved.map((s) =>
                s.id === row.id
                  ? {
                      ...s,
                      pantry_match_pct: row.pantry_match_pct,
                      missing_ingredients: row.missing_ingredients ?? [],
                    }
                  : s
              )
            ),
          });
        }
      )
      .subscribe();

    set({ channel });
  },

  unsubscribe: () => {
    const ch = get().channel;
    if (ch) {
      supabase.removeChannel(ch);
      set({ channel: null });
    }
  },
}));
