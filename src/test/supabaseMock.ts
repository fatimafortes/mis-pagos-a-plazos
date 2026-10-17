// Minimal chainable stand-in for the Supabase query builder, recording every call.
export interface Call { table: string; op: string; args: unknown[]; filters: [string, unknown][] }

export function createSupabaseMock() {
  const calls: Call[] = [];
  const results: Record<string, { data: unknown; error: unknown; count?: number | null }> = {};

  const client = {
    from(table: string) {
      const call: Call = { table, op: "", args: [], filters: [] };
      calls.push(call);
      const result = () => results[`${table}.${call.op}`] ?? { data: null, error: null };
      const builder: Record<string, unknown> = {
        eq: (col: string, val: unknown) => (call.filters.push([col, val]), builder),
        gte: (col: string, val: unknown) => (call.filters.push([`${col}>=`, val]), builder),
        // A bare select is the operation; after insert/delete it only shapes the returned rows.
        select: (...args: unknown[]) => (call.op || ((call.op = "select"), (call.args = args)), builder),
        single: async () => result(),
        maybeSingle: async () => result(),
        then: (resolve: (v: unknown) => void) => resolve(result()),
      };
      for (const op of ["insert", "update", "upsert", "delete"]) {
        builder[op] = (...args: unknown[]) => ((call.op = op), (call.args = args), builder);
      }
      return builder;
    },
  };

  return {
    client,
    calls,
    /** Sets what `${table}.${op}` resolves to. */
    respond: (key: string, data: unknown, error: unknown = null, count?: number | null) => {
      results[key] = { data, error, count };
    },
    reset: () => { calls.length = 0; for (const k of Object.keys(results)) delete results[k]; },
  };
}
