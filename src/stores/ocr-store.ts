import { create } from 'zustand';

import { insertPantryItemsBatch } from '@/lib/pantry';
import { OcrError, scanReceipt, type OcrErrorKind, type OcrItem } from '@/lib/ocr';
import { usePantryStore } from './pantry-store';

type OcrStatus = 'idle' | 'processing' | 'review' | 'error';

interface OcrState {
  status: OcrStatus;
  items: OcrItem[];
  droppedCount: number;
  errorKind: OcrErrorKind | null;

  /** Run OCR on a captured base64 image (sets processing → review/error). */
  runScan: (imageBase64: string) => Promise<void>;
  /** Remove a parsed item before confirming. */
  removeItem: (index: number) => void;
  /** Batch-insert the remaining items; reloads the pantry. Returns count added. */
  confirm: () => Promise<number>;
  reset: () => void;
}

export const useOcrStore = create<OcrState>((set, get) => ({
  status: 'idle',
  items: [],
  droppedCount: 0,
  errorKind: null,

  runScan: async (imageBase64) => {
    set({ status: 'processing', items: [], droppedCount: 0, errorKind: null });
    try {
      const result = await scanReceipt(imageBase64);
      set({ status: 'review', items: result.items, droppedCount: result.dropped_count });
    } catch (e) {
      set({ status: 'error', errorKind: e instanceof OcrError ? e.kind : 'generic' });
    }
  },

  removeItem: (index) => set({ items: get().items.filter((_, i) => i !== index) }),

  confirm: async () => {
    const { items } = get();
    if (items.length === 0) {
      get().reset();
      return 0;
    }
    await insertPantryItemsBatch(
      items.map((it) => ({
        ingredient_id: it.ingredient_id,
        quantity: it.quantity,
        expires_at: it.expires_at,
      }))
    );
    await usePantryStore.getState().loadAll();
    get().reset();
    return items.length;
  },

  reset: () => set({ status: 'idle', items: [], droppedCount: 0, errorKind: null }),
}));
