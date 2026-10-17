import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "@/test/supabaseMock";

const db = createSupabaseMock();
let user: { id: string } | null = { id: "user-a" };
vi.mock("@/lib/supabase/server", () => ({ currentUser: async () => ({ user, supabase: db.client }) }));

const { POST } = await import("./route");
const post = (body: unknown) => POST(new Request("http://x/api/status", { method: "POST", body: JSON.stringify(body) }));

describe("POST /api/status", () => {
  beforeEach(() => {
    db.reset();
    user = { id: "user-a" };
  });

  it("upserts the answer for the session's user", async () => {
    const res = await post({ completeness: "complete_as_shown" });
    expect(res.status).toBe(200);
    expect(db.calls[0]).toMatchObject({ table: "w10_ledger_status", op: "upsert" });
    expect(db.calls[0].args[0]).toMatchObject({ user_id: "user-a", completeness: "complete_as_shown" });
  });

  it("rejects values outside the three states, and a client user_id", async () => {
    expect((await post({ completeness: "complete" })).status).toBe(400);
    expect((await post({ completeness: "incomplete", user_id: "user-b" })).status).toBe(400);
    expect(db.calls).toEqual([]);
  });

  it("requires a session", async () => {
    user = null;
    expect((await post({ completeness: "incomplete" })).status).toBe(401);
  });
});
