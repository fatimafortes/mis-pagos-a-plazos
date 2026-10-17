import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "@/test/supabaseMock";

const db = createSupabaseMock();
let user: { id: string } | null = { id: "user-a" };

vi.mock("@/lib/supabase/server", () => ({ currentUser: async () => ({ user, supabase: db.client }) }));
vi.mock("@/lib/extraction", async (orig) => ({
  ...(await orig<typeof import("@/lib/extraction")>()),
  todayInMexico: () => ({ y: 2026, m: 10, d: 16 }),
}));

const { POST } = await import("./route");

const plan = {
  provider_name: "PagaLuego", installment_amount: 412.5, payments_remaining: 4,
  next_due_date: "2026-10-30", frequency: "quincenal",
  field_sources: {
    provider_name: "screenshot", installment_amount: "user", payments_remaining: "screenshot",
    next_due_date: "screenshot", frequency: "user", next_due_date_year: "calculated",
  },
};
const post = (body: unknown) =>
  POST(new Request("http://x/api/plans", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));
const inserts = () => db.calls.filter((c) => c.op === "insert");

describe("POST /api/plans", () => {
  beforeEach(() => {
    db.reset();
    db.respond("w10_payment_plans.insert", { id: "plan-1" });
    user = { id: "user-a" };
    vi.stubEnv("SIMULATE_AI", "false");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("saves a valid plan with the session's user_id", async () => {
    const res = await post({ plan });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: "plan-1" });
    expect(inserts()).toEqual([
      { table: "w10_payment_plans", op: "insert", args: [{ ...plan, user_id: "user-a" }], filters: [] },
    ]);
  });

  it("keeps the simulated mark sent by the client", async () => {
    await post({ plan: { ...plan, field_sources: { ...plan.field_sources, simulated: true } } });
    expect((inserts()[0].args[0] as typeof plan & { field_sources: { simulated?: true } }).field_sources.simulated).toBe(true);
  });

  it("marks the plan simulated when SIMULATE_AI=true, even if the client omits it", async () => {
    vi.stubEnv("SIMULATE_AI", "true");
    await post({ plan });
    expect((inserts()[0].args[0] as { field_sources: { simulated?: true } }).field_sources.simulated).toBe(true);
  });

  it("never marks a plan typed by hand as simulated, even with SIMULATE_AI=true", async () => {
    vi.stubEnv("SIMULATE_AI", "true");
    const manual = {
      ...plan,
      field_sources: {
        provider_name: "user", installment_amount: "user", payments_remaining: "user",
        next_due_date: "user", frequency: "user", simulated: true,
      },
    };
    expect((await post({ plan: manual })).status).toBe(201);
    expect((inserts()[0].args[0] as { field_sources: object }).field_sources).not.toHaveProperty("simulated");
  });

  describe("same plan saved twice", () => {
    const existing = {
      id: "old", provider_name: "pagaluego ", installment_amount: "412.50", payments_remaining: 2,
      next_due_date: "2026-10-30", frequency: "quincenal", field_sources: plan.field_sources,
    };

    it("asks instead of saving when app, amount, date and frequency match", async () => {
      db.respond("w10_payment_plans.select", [existing]);
      const res = await post({ plan });
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({
        duplicate: true, error: "Ya tienes un plan igual de PagaLuego. ¿Es otra compra o el mismo?",
      });
      expect(inserts()).toEqual([]);
      expect(db.calls[0].filters).toEqual([["user_id", "user-a"]]);
    });

    it("saves it when the user answered 'Es otra compra, guardar'", async () => {
      db.respond("w10_payment_plans.select", [existing]);
      const res = await post({ plan, allowDuplicate: true });
      expect(res.status).toBe(201);
      expect(inserts()).toHaveLength(1);
    });

    it("saves a plan that differs in any of the four fields", async () => {
      db.respond("w10_payment_plans.select", [{ ...existing, installment_amount: "412.00" }]);
      expect((await post({ plan })).status).toBe(201);
    });

    it("applies to plans typed by hand too", async () => {
      const manual = {
        ...plan,
        field_sources: {
          provider_name: "user", installment_amount: "user", payments_remaining: "user",
          next_due_date: "user", frequency: "user",
        },
      };
      db.respond("w10_payment_plans.select", [existing]);
      expect((await post({ plan: manual })).status).toBe(409);
    });
  });

  it("resets 'complete as shown' to incomplete for this user only", async () => {
    await post({ plan });
    const reset = db.calls.find((c) => c.table === "w10_ledger_status");
    expect(reset?.op).toBe("update");
    expect(reset?.args[0]).toMatchObject({ completeness: "incomplete" });
    expect(reset?.filters).toEqual([["user_id", "user-a"], ["completeness", "complete_as_shown"]]);
  });

  it("requires a session", async () => {
    user = null;
    expect((await post({ plan })).status).toBe(401);
    expect(db.calls).toEqual([]);
  });

  it("refuses a user_id sent by the client", async () => {
    expect((await post({ plan: { ...plan, user_id: "user-b" } })).status).toBe(400);
    expect(db.calls).toEqual([]);
  });

  it("rejects invalid values even if the client let them through", async () => {
    const res = await post({ plan: { ...plan, installment_amount: -20 } });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/negativo/);
    expect(db.calls).toEqual([]);
  });

  it("rejects simulated: false or other values", async () => {
    const res = await post({ plan: { ...plan, field_sources: { ...plan.field_sources, simulated: "yes" } } });
    expect(res.status).toBe(400);
  });

  it("rejects a body that is not JSON", async () => {
    expect((await post("not json")).status).toBe(400);
  });
});
