import { beforeEach, describe, expect, it, vi } from "vitest";

const insert = vi.fn();
let user: { id: string } | null = { id: "user-a" };

vi.mock("@/lib/supabase/server", () => ({
  currentUser: async () => ({
    user,
    supabase: {
      from: (table: string) => ({
        insert: (row: unknown) => {
          insert(table, row);
          return { select: () => ({ single: async () => ({ data: { id: "plan-1" }, error: null }) }) };
        },
      }),
    },
  }),
}));
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

describe("POST /api/plans", () => {
  beforeEach(() => {
    insert.mockClear();
    user = { id: "user-a" };
  });

  it("saves a valid plan with the session's user_id", async () => {
    const res = await post({ plan });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: "plan-1" });
    expect(insert).toHaveBeenCalledWith("w10_payment_plans", { ...plan, user_id: "user-a" });
  });

  it("requires a session", async () => {
    user = null;
    expect((await post({ plan })).status).toBe(401);
    expect(insert).not.toHaveBeenCalled();
  });

  it("refuses a user_id sent by the client", async () => {
    expect((await post({ plan: { ...plan, user_id: "user-b" } })).status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects invalid values even if the client let them through", async () => {
    const res = await post({ plan: { ...plan, installment_amount: -20 } });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/negativo/);
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects a body that is not JSON", async () => {
    expect((await post("not json")).status).toBe(400);
  });
});
