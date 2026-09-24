import 'server-only';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import type { ZodType } from 'zod';

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const MODELS = [...new Set([MODEL, 'gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-flash-latest', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'])];
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
const KEY = process.env.GEMINI_API_KEY ?? '';

// DEMO_MODE (or no key) serves cached responses so the pitch works without Wi-Fi.
export const demoMode = process.env.DEMO_MODE === 'true' || KEY.length < 20;

let client: GoogleGenAI | null = null;
const ai = () => (client ??= new GoogleGenAI({ apiKey: KEY }));

export type ImagePart = { mimeType: string; data: string }; // base64, no data: prefix

export async function generateJSON<T>(opts: {
  system: string;
  prompt: string;
  images?: ImagePart[];
  jsonSchema: object;
  zod: ZodType<T>;
}): Promise<T> {
  const parts = [
    ...(opts.images ?? []).map((img) => ({ inlineData: { mimeType: img.mimeType, data: img.data } })),
    { text: opts.prompt },
  ];
  let lastError: unknown;
  // If a model is overloaded (503), rate-limited (429) or retired (404), fall through to the next one.
  for (const model of MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await ai().models.generateContent({
          model,
          contents: [{ role: 'user', parts }],
          config: {
            systemInstruction: opts.system,
            responseMimeType: 'application/json',
            responseJsonSchema: opts.jsonSchema,
            temperature: 0.2,
            // Extraction and letters don't need deep reasoning; keep latency low for a live demo.
            thinkingConfig: model.includes('2.5') ? { thinkingBudget: 0 } : { thinkingLevel: ThinkingLevel.LOW },
          },
        });
        const parsed = opts.zod.safeParse(JSON.parse(res.text ?? ''));
        if (parsed.success) return parsed.data;
        lastError = parsed.error; // malformed JSON: retry the same model once
      } catch (e) {
        lastError = e;
        const status = (e as { status?: number }).status;
        if (status === 404) break; // retired model: go straight to the next one
        if (status === 503 || status === 429) { if (attempt === 0) { await pause(1200); continue; } break; } // busy: one short retry, then next model
        if (status && status >= 400 && status < 500) throw e; // bad request: another model won't help
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error('The AI response could not be read.');
}
