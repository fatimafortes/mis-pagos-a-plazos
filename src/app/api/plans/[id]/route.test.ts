import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "@/test/supabaseMock";

const db = createSupabaseMock();
let user: { id: string } | null = { id: "user-a" };
vi.mock("@/lib/supabase/server", () => ({ currentUser: async () => ({ user, supabase: db.client }) }));

const { DELETE } = await import("./route");

const ID = "3f1c2b9e-8a4d-4c6e-9b2f-1a2b3c4d5e6f";
const del = (id: string) => DELETE(new Request(`http://x/api/plans/${id}`, { method: "DELETE" }), { params: Promise.resolve({ id }) });

describe("DELETE /api/plans/:id", () => {
  beforeEach(() => {
    db.reset();
    user = { id: "user-a" };
  });

  it("deletes the user's own plan, filtered by id and user_id", async () => {
    db.respond("w10_payment_plans.delete", [{ id: ID }]);
    const res = await del(ID);
    expect(res.status).toBe(200);
    expect(db.calls).toEqual([
      { table: "w10_payment_plans", op: "delete", args: [], filters: [["id", ID], ["user_id", "user-a"]] },
    ]);
  });

  it("returns 404 when RLS hides the row (another user's plan or already deleted)", async () => {
    db.respond("w10_payment_plans.delete", []);
    expect((await del(ID)).status).toBe(404);
  });

  it("requires a session", async () => {
    user = null;
    expect((await del(ID)).status).toBe(401);
    expect(db.calls).toEqual([]);
  });

  it("rejects ids that are not UUIDs", async () => {
    expect((await del("1 or 1=1")).status).toBe(400);
    expect(db.calls).toEqual([]);
  });

  it("reports database errors without leaking them", async () => {
    db.respond("w10_payment_plans.delete", null, { code: "42501", message: "permission denied" });
    const res = await del(ID);
    expect(res.status).toBe(500);
    expect((await res.json()).error).not.toMatch(/permission/);
  });
});
