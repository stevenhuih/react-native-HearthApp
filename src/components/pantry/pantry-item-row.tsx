import { Text, View } from 'react-native';

import { expiryLabel, expiryTone, type ExpiryTone } from '@/lib/expiry';
import type { PantryItem } from '@/types/db';

// TODO(design): finalize expiry chip colors/treatment.
const TONE_CLASS: Record<ExpiryTone, string> = {
  red: 'text-error',
  amber: 'text-warning-text',
  grey: 'text-muted',
};

/** Presentational pantry row: name, qty+unit (stock units), expiry chip. */
export function PantryItemRow({ item }: { item: PantryItem }) {
  const tone = expiryTone(item.expires_at);
  const showQty = item.ingredient.track_quantity && item.quantity != null;

  return (
    // Opaque bg so the red/green swipe panel only shows while swiping.
    <View className="flex-row items-center justify-between bg-surface px-4 py-3">
      <View className="flex-1 gap-0.5">
        <Text className="type-body">{item.ingredient.name}</Text>
        {showQty ? (
          <Text className="type-caption">
            {item.quantity} {item.ingredient.default_unit}
          </Text>
        ) : null}
      </View>
      <Text className={`type-body-sm ${TONE_CLASS[tone]}`}>{expiryLabel(item.expires_at)}</Text>
    </View>
  );
}
