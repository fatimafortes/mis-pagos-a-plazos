// Minimal chainable stand-in for the Supabase query builder, recording every call.
export interface Call { table: string; op: string; args: unknown[]; filters: [string, unknown][] }

export function createSupabaseMock() {
  const calls: Call[] = [];
  const results: Record<string, { data: unknown; error: unknown }> = {};

  const client = {
    from(table: string) {
      const call: Call = { table, op: "", args: [], filters: [] };
      calls.push(call);
      const result = () => results[`${table}.${call.op}`] ?? { data: null, error: null };
      const builder: Record<string, unknown> = {
        eq: (col: string, val: unknown) => (call.filters.push([col, val]), builder),
        select: () => builder,
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
    respond: (key: string, data: unknown, error: unknown = null) => { results[key] = { data, error }; },
    reset: () => { calls.length = 0; for (const k of Object.keys(results)) delete results[k]; },
  };
}
