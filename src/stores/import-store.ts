import { create } from 'zustand';

import { ImportError, importRecipe, type ImportErrorKind, type ImportResult } from '@/lib/import';

type ImportStatus = 'idle' | 'processing' | 'done' | 'error';

interface ImportState {
  status: ImportStatus;
  result: ImportResult | null;
  errorKind: ImportErrorKind | null;
  run: (url: string) => Promise<void>;
  reset: () => void;
}

export const useImportStore = create<ImportState>((set) => ({
  status: 'idle',
  result: null,
  errorKind: null,

  // Whisper fallback is invisible to the user — the status is just "processing".
  run: async (url) => {
    set({ status: 'processing', result: null, errorKind: null });
    try {
      const result = await importRecipe(url);
      set({ status: 'done', result });
    } catch (e) {
      set({ status: 'error', errorKind: e instanceof ImportError ? e.kind : 'generic' });
    }
  },

  reset: () => set({ status: 'idle', result: null, errorKind: null }),
}));
