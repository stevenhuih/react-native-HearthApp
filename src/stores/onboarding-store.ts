import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { EMPTY_DIETARY_PROFILE, type ArchetypeSeed, type DietaryProfile } from '@/types/db';

/**
 * Local wizard state for the 4-step onboarding flow (AGENTS.md: Zustand for
 * ephemeral UI state). Persisted to AsyncStorage so a user who abandons
 * mid-flow resumes from their last step (US-001 edge case).
 */
interface OnboardingState {
  /** 1-based step the user last reached, for resume-on-return. */
  lastStep: number;

  // Step 2 — archetype
  archetypeId: number | null;
  /** The chosen archetype's seeds — passed to completeOnboarding for the Edge Function. */
  seeds: ArchetypeSeed[];
  /** ingredient_ids the user kept (unchecked items removed) in the confirm sub-step. */
  confirmedItemIds: number[];

  // Step 3 — dietary profile
  dietaryProfile: DietaryProfile;

  setLastStep: (step: number) => void;
  /** Selecting an archetype pre-checks all of its items. */
  selectArchetype: (id: number, seeds: ArchetypeSeed[]) => void;
  toggleConfirmedItem: (ingredientId: number) => void;
  setDietaryProfile: (profile: DietaryProfile) => void;
  reset: () => void;
}

const initialState = {
  lastStep: 1,
  archetypeId: null as number | null,
  seeds: [] as ArchetypeSeed[],
  confirmedItemIds: [] as number[],
  dietaryProfile: EMPTY_DIETARY_PROFILE,
};

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      ...initialState,

      setLastStep: (step) => set({ lastStep: step }),

      selectArchetype: (id, seeds) =>
        set({ archetypeId: id, seeds, confirmedItemIds: seeds.map((s) => s.ingredient_id) }),

      toggleConfirmedItem: (ingredientId) =>
        set((state) => ({
          confirmedItemIds: state.confirmedItemIds.includes(ingredientId)
            ? state.confirmedItemIds.filter((id) => id !== ingredientId)
            : [...state.confirmedItemIds, ingredientId],
        })),

      setDietaryProfile: (profile) => set({ dietaryProfile: profile }),

      reset: () => set(initialState),
    }),
    {
      name: 'hearth.onboarding',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
