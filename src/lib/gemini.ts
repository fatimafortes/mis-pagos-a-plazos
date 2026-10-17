// Server only: import this from route handlers, never from client components.
import { GoogleGenAI } from "@google/genai";
import { RESPONSE_JSON_SCHEMA, SYSTEM_PROMPT, USER_PROMPT } from "./extraction";

// Current stable free-tier Flash model (ai.google.dev/gemini-api/docs/models, checked 2026-10-16).
export const GEMINI_MODEL = "gemini-3.8-flash";
const TIMEOUT_MS = 45_000; // blurry screenshots took over 25 s in the eval

/** Sends the image to Gemini and returns its raw JSON text. Throws on any API failure. */
export async function callGemini(bytes: Uint8Array, mimeType: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY no está configurada.");
  const ai = new GoogleGenAI({ apiKey });
  const res = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType, data: Buffer.from(bytes).toString("base64") } },
          { text: USER_PROMPT },
        ],
      },
    ],
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseJsonSchema: RESPONSE_JSON_SCHEMA,
      temperature: 0,
      abortSignal: AbortSignal.timeout(TIMEOUT_MS),
    },
  });
  const text = res.text;
  if (!text) throw new Error("Gemini devolvió una respuesta vacía.");
  return text;
}
