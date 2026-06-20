import { create } from 'zustand';

import { fetchFeed, likeRecipe, unlikeRecipe } from '@/lib/feed';
import type { FeedRecipe } from '@/types/db';

interface FeedState {
  items: FeedRecipe[];
  isLoading: boolean;
  error: string | null;
  load: () => Promise<void>;
  toggleLike: (recipeId: string) => Promise<void>;
}

export const useFeedStore = create<FeedState>((set, get) => ({
  items: [],
  isLoading: false,
  error: null,

  load: async () => {
    set({ isLoading: true, error: null });
    try {
      const items = await fetchFeed();
      set({ items, isLoading: false });
    } catch {
      set({
        isLoading: false,
        error: "We couldn't load the feed. Pull to refresh or check your connection.",
      });
    }
  },

  // Optimistic like (US-V2-01): flip liked + like_count immediately, reconcile with
  // the server, roll back on failure. The DB trigger keeps the authoritative count;
  // the client never writes like_count. No Realtime on the feed (AGENTS.md).
  toggleLike: async (recipeId) => {
    const before = get().items;
    const target = before.find((it) => it.id === recipeId);
    if (!target) return;
    const nextLiked = !target.liked;

    set({
      items: before.map((it) =>
        it.id === recipeId
          ? { ...it, liked: nextLiked, like_count: Math.max(0, it.like_count + (nextLiked ? 1 : -1)) }
          : it
      ),
    });

    try {
      if (nextLiked) await likeRecipe(recipeId);
      else await unlikeRecipe(recipeId);
    } catch {
      set({ items: get().items.map((it) => (it.id === recipeId ? target : it)) }); // roll back this card
    }
  },
}));
