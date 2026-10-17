import { describe, expect, it } from "vitest";
import { MAX_BYTES, checkFileBytes, checkFileMeta, sniffImageType } from "./upload";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const PDF = new TextEncoder().encode("%PDF-1.7 ...");

describe("checkFileMeta (client + server)", () => {
  it("accepts png and jpg up to 5 MB", () => {
    expect(checkFileMeta({ type: "image/png", size: 1000 }).ok).toBe(true);
    expect(checkFileMeta({ type: "image/jpeg", size: MAX_BYTES }).ok).toBe(true);
  });

  it("rejects a PDF", () => {
    expect(checkFileMeta({ type: "application/pdf", size: 1000 })).toEqual({
      ok: false, error: "Solo acepto capturas en PNG o JPG.",
    });
  });

  it("rejects other image types", () => {
    expect(checkFileMeta({ type: "image/webp", size: 1000 }).ok).toBe(false);
    expect(checkFileMeta({ type: "image/heic", size: 1000 }).ok).toBe(false);
  });

  it("rejects a 10 MB file and anything over 5 MB", () => {
    expect(checkFileMeta({ type: "image/png", size: 10 * 1024 * 1024 }).ok).toBe(false);
    expect(checkFileMeta({ type: "image/png", size: MAX_BYTES + 1 }).ok).toBe(false);
  });

  it("rejects a missing or empty file", () => {
    expect(checkFileMeta(null).ok).toBe(false);
    expect(checkFileMeta({ type: "image/png", size: 0 }).ok).toBe(false);
  });
});

describe("sniffImageType", () => {
  it("recognizes png and jpg signatures", () => {
    expect(sniffImageType(PNG)).toBe("image/png");
    expect(sniffImageType(JPG)).toBe("image/jpeg");
  });

  it("returns null for anything else", () => {
    expect(sniffImageType(PDF)).toBeNull();
    expect(sniffImageType(new Uint8Array([]))).toBeNull();
  });
});

describe("checkFileBytes (server)", () => {
  it("accepts when declared type and bytes agree", () => {
    expect(checkFileBytes({ type: "image/png", size: PNG.length }, PNG)).toEqual({ ok: true, type: "image/png" });
  });

  it("rejects a PDF renamed to .png", () => {
    expect(checkFileBytes({ type: "image/png", size: PDF.length }, PDF).ok).toBe(false);
  });

  it("rejects a jpg declared as png", () => {
    expect(checkFileBytes({ type: "image/png", size: JPG.length }, JPG).ok).toBe(false);
  });

  it("rejects oversized bytes even if declared size lies", () => {
    const big = new Uint8Array(MAX_BYTES + 1);
    big.set(PNG);
    expect(checkFileBytes({ type: "image/png", size: 100 }, big).ok).toBe(false);
  });
});
