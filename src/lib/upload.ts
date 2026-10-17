// Screenshot upload rules, shared by the client form and the server route.
// The image is only ever held in memory; nothing here writes to storage (C4).

export const MAX_BYTES = 5 * 1024 * 1024;
export const ALLOWED_TYPES = ["image/png", "image/jpeg"] as const;
export const ACCEPT_ATTR = ".png,.jpg,.jpeg,image/png,image/jpeg";

export type AllowedType = (typeof ALLOWED_TYPES)[number];

export type UploadCheck =
  | { ok: true; type: AllowedType }
  | { ok: false; error: string };

const ERR_EMPTY = "Elige una captura de pantalla.";
const ERR_TYPE = "Solo acepto capturas en PNG o JPG.";
const ERR_SIZE = "La captura pesa más de 5 MB. Recórtala o tómala de nuevo.";

/** Checks declared type and size. Enough for the client; the server also checks bytes. */
export function checkFileMeta(file: { type: string; size: number } | null | undefined): UploadCheck {
  if (!file || file.size === 0) return { ok: false, error: ERR_EMPTY };
  if (!(ALLOWED_TYPES as readonly string[]).includes(file.type)) return { ok: false, error: ERR_TYPE };
  if (file.size > MAX_BYTES) return { ok: false, error: ERR_SIZE };
  return { ok: true, type: file.type as AllowedType };
}

/** Real type from the first bytes, so a renamed PDF is not accepted as a PNG. */
export function sniffImageType(bytes: Uint8Array): AllowedType | null {
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= png.length && png.every((b, i) => bytes[i] === b)) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  return null;
}

/** Server-side check: metadata plus content must agree. */
export function checkFileBytes(meta: { type: string; size: number }, bytes: Uint8Array): UploadCheck {
  const metaCheck = checkFileMeta(meta);
  if (!metaCheck.ok) return metaCheck;
  if (bytes.length > MAX_BYTES) return { ok: false, error: ERR_SIZE };
  const real = sniffImageType(bytes);
  if (real === null || real !== metaCheck.type) return { ok: false, error: ERR_TYPE };
  return { ok: true, type: real };
}
