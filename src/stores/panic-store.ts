import { create } from 'zustand';

import { runPanic, type PanicResponse } from '@/lib/panic';

type PanicStatus = 'idle' | 'loading' | 'done' | 'error';

interface PanicState {
  status: PanicStatus;
  result: PanicResponse | null;
  run: () => Promise<void>;
  reset: () => void;
}

export const usePanicStore = create<PanicState>((set) => ({
  status: 'idle',
  result: null,

  run: async () => {
    set({ status: 'loading', result: null });
    try {
      const result = await runPanic();
      set({ status: 'done', result });
    } catch {
      set({ status: 'error', result: null });
    }
  },

  reset: () => set({ status: 'idle', result: null }),
}));
