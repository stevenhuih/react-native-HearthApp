import { View } from 'react-native';

import { ONBOARDING_STEP_COUNT } from '@/constants/onboarding';

/**
 * Visible 4-step progress bar (US-001). Renders one segment per step and fills
 * segments up to and including `step` (1-based).
 *
 * // TODO(design): finalize segment colors, height, spacing, and the
 * // active/inactive treatment in the design pass.
 */
export function OnboardingProgress({
  step,
  total = ONBOARDING_STEP_COUNT,
}: {
  step: number;
  total?: number;
}) {
  return (
    <View className="flex-row gap-2 px-6 pt-2" accessibilityLabel={`Step ${step} of ${total}`}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          className={`h-1 flex-1 rounded-full ${i < step ? 'bg-terracotta' : 'bg-border'}`}
        />
      ))}
    </View>
  );
}
