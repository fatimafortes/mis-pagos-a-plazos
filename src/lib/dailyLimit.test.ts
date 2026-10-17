import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseMock } from "@/test/supabaseMock";
import { DAILY_LIMIT, claimDailyScreenshot, startOfTodayMexico } from "./dailyLimit";

const db = createSupabaseMock();
const client = db.client as unknown as SupabaseClient;
const now = new Date("2026-10-17T03:00:00Z"); // still 16 Oct in Mexico City

describe("startOfTodayMexico", () => {
  it("is midnight of the Mexico City day, not the UTC day", () => {
    expect(startOfTodayMexico(now)).toBe("2026-10-16T00:00:00-06:00");
  });
});

describe("claimDailyScreenshot", () => {
  beforeEach(() => db.reset());

  it("counts only this user's screenshots since midnight and records the new one", async () => {
    db.respond("w10_extraction_log.select", null, null, 3);
    expect(await claimDailyScreenshot(client, "user-a", now)).toEqual({ allowed: true, remaining: 6 });
    expect(db.calls[0].filters).toEqual([["user_id", "user-a"], ["created_at>=", "2026-10-16T00:00:00-06:00"]]);
    expect(db.calls[1]).toMatchObject({ table: "w10_extraction_log", op: "insert", args: [{ user_id: "user-a" }] });
  });

  it("the 10th screenshot is allowed with 0 left", async () => {
    db.respond("w10_extraction_log.select", null, null, DAILY_LIMIT - 1);
    expect(await claimDailyScreenshot(client, "user-a", now)).toEqual({ allowed: true, remaining: 0 });
  });

  it("the 11th is refused and not recorded", async () => {
    db.respond("w10_extraction_log.select", null, null, DAILY_LIMIT);
    expect(await claimDailyScreenshot(client, "user-a", now)).toEqual({ allowed: false });
    expect(db.calls.some((c) => c.op === "insert")).toBe(false);
  });

  it("fails open, logging the error, if the log table can't be read", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    db.respond("w10_extraction_log.select", null, { code: "42P01", message: "relation does not exist" });
    expect(await claimDailyScreenshot(client, "user-a", now)).toEqual({ allowed: true, remaining: null });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
