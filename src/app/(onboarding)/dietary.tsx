import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OnboardingProgress } from '@/components/onboarding-progress';
import { ALLERGEN_OPTIONS, CUISINE_OPTIONS, RESTRICTION_OPTIONS } from '@/constants/onboarding';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { EMPTY_DIETARY_PROFILE } from '@/types/db';

// Step 3 of 4 — Dietary Profile. Multi-select allergens / restrictions /
// cuisine preferences. Fully skippable (US-001).
export default function DietaryScreen() {
  const router = useRouter();
  const { dietaryProfile, setDietaryProfile, setLastStep } = useOnboardingStore();

  const [allergens, setAllergens] = useState<string[]>(dietaryProfile.allergens);
  const [restrictions, setRestrictions] = useState<string[]>(dietaryProfile.restrictions);
  const [cuisinePrefs, setCuisinePrefs] = useState<string[]>(dietaryProfile.cuisine_prefs);

  useEffect(() => setLastStep(3), [setLastStep]);

  function toggle(list: string[], setList: (v: string[]) => void, value: string) {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  function handleContinue() {
    setDietaryProfile({ allergens, restrictions, cuisine_prefs: cuisinePrefs });
    router.push('/(onboarding)/first-scan');
  }

  function handleSkip() {
    setDietaryProfile(EMPTY_DIETARY_PROFILE);
    router.push('/(onboarding)/first-scan');
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <OnboardingProgress step={3} />
      <View className="px-6 pt-4 gap-1">
        <Text className="type-h2">Anything we should know?</Text>
        {/* Allergens are a hard safety constraint downstream (AGENTS.md rule #7). */}
        <Text className="type-body-sm">Allergens are always respected. You can skip this step.</Text>
      </View>

      <ScrollView className="flex-1">
        <View className="p-6 gap-6">
          <ChipGroup
            title="Allergens"
            options={[...ALLERGEN_OPTIONS]}
            selected={allergens}
            onToggle={(v) => toggle(allergens, setAllergens, v)}
          />
          <ChipGroup
            title="Dietary restrictions"
            options={[...RESTRICTION_OPTIONS]}
            selected={restrictions}
            onToggle={(v) => toggle(restrictions, setRestrictions, v)}
          />
          <ChipGroup
            title="Cuisine preferences"
            options={[...CUISINE_OPTIONS]}
            selected={cuisinePrefs}
            onToggle={(v) => toggle(cuisinePrefs, setCuisinePrefs, v)}
          />
        </View>
      </ScrollView>

      <View className="p-6 gap-3">
        <Pressable className="btn btn-primary" onPress={handleContinue}>
          <Text className="type-button text-white">Continue</Text>
        </Pressable>
        <Pressable className="items-center" onPress={handleSkip}>
          <Text className="type-body-sm">Skip for now</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function ChipGroup({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <View className="gap-2">
      <Text className="type-h4">{title}</Text>
      {/* TODO(design): chip styling, selected-state colors, capitalization. */}
      <View className="flex-row flex-wrap gap-2">
        {options.map((opt) => {
          const active = selected.includes(opt);
          return (
            <Pressable
              key={opt}
              onPress={() => onToggle(opt)}
              className={`rounded-full border px-4 py-2 ${active ? 'border-terracotta bg-cream-deep' : 'border-border'}`}>
              <Text className="type-body-sm">{opt}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
