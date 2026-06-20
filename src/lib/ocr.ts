import * as ImagePicker from 'expo-image-picker';

import { supabase } from './supabase';

export interface OcrItem {
  ingredient_id: number;
  name: string;
  quantity: number | null;
  unit: string;
  expires_at: string | null;
}

export interface OcrResult {
  items: OcrItem[];
  dropped_count: number;
}

export type OcrErrorKind = 'unreadable' | 'generic';

export class OcrError extends Error {
  kind: OcrErrorKind;
  constructor(kind: OcrErrorKind) {
    super(kind);
    this.kind = kind;
  }
}

/**
 * Launch the camera and return a base64 JPEG of the receipt (or null if the
 * user cancels / denies permission). Requires the expo-image-picker native
 * module — only present after a dev build that includes it.
 */
export async function captureReceiptImage(): Promise<string | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return null;
  const res = await ImagePicker.launchCameraAsync({
    base64: true,
    quality: 0.6,
    allowsEditing: false,
    // TODO(design): consider a guided receipt frame / cropping UX.
  });
  if (res.canceled || !res.assets?.[0]?.base64) return null;
  return res.assets[0].base64;
}

/** Calls the ocr-receipt Edge Function. Throws OcrError('unreadable'|'generic'). */
export async function scanReceipt(imageBase64: string): Promise<OcrResult> {
  const { data, error } = await supabase.functions.invoke('ocr-receipt', {
    body: { image_base64: imageBase64 },
  });
  if (error) throw await toOcrError(error);
  return data as OcrResult;
}

async function toOcrError(error: unknown): Promise<OcrError> {
  // supabase-js FunctionsHttpError exposes the Response on `context`.
  try {
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      const body = await ctx.json();
      if (body?.error === 'unreadable') return new OcrError('unreadable');
    }
  } catch {
    /* fall through */
  }
  return new OcrError('generic');
}
