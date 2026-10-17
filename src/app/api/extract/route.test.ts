import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const callGemini = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ currentUser: async () => ({ user: { id: "user-a" }, supabase: {} }) }));
vi.mock("@/lib/gemini", () => ({ callGemini: (...args: unknown[]) => callGemini(...args) }));

const { POST } = await import("./route");

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const upload = () => {
  const body = new FormData();
  body.append("file", new File([PNG], "c.png", { type: "image/png" }));
  return POST(new Request("http://x/api/extract", { method: "POST", body }));
};

describe("POST /api/extract when Gemini fails", () => {
  beforeEach(() => callGemini.mockReset());
  afterEach(() => vi.unstubAllEnvs());

  it("with SIMULATE_AI=false shows the 'try later or enter it by hand' message, never SIMULADO", async () => {
    vi.stubEnv("SIMULATE_AI", "false");
    vi.spyOn(console, "error").mockImplementation(() => {});
    for (const msg of ["429 RESOURCE_EXHAUSTED", "This operation was aborted", "500 internal"]) {
      callGemini.mockRejectedValueOnce(new Error(msg));
      const res = await upload();
      const data = await res.json();
      expect(res.status).toBe(503);
      expect(data).toEqual({ error: "No pude leer la captura ahora. Intenta más tarde o captúralo a mano." });
    }
  });

  it("with SIMULATE_AI=true returns SIMULADO without calling Gemini", async () => {
    vi.stubEnv("SIMULATE_AI", "true");
    const res = await upload();
    expect(res.status).toBe(200);
    expect((await res.json()).simulated).toBe(true);
    expect(callGemini).not.toHaveBeenCalled();
  });
});
