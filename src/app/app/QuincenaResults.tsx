import { formatPesos, type Schedule } from "@/lib/quincenas";
import { COMPLETENESS_BANNER, type Completeness } from "@/lib/plans";

const SIM = <span className="sim-tag">SIMULADO</span>;
const NOT_SUMMED = <span className="small muted"> · no se suma</span>;

// All numbers here come from buildSchedule (lib/quincenas.ts); the LLM never computes totals (C2).
export default function QuincenaResults({
  schedule,
  completeness,
  planCount,
}: {
  schedule: Schedule;
  completeness: Completeness;
  planCount: number;
}) {
  const banner = COMPLETENESS_BANNER[completeness];
  const hasSimulated =
    schedule.rows.some((r) => r.items.some((it) => it.simulated)) || schedule.undated.some((u) => u.simulated);

  return (
    <section aria-labelledby="results-title">
      <h2 id="results-title" style={{ marginTop: 24 }}>Vence por quincena</h2>
      <p className={`banner${completeness === "complete_as_shown" ? " ok" : ""}`}>
        <b>{banner.title}</b>
        {banner.body}
      </p>

      {planCount === 0 ? (
        <p className="card small muted">Aún no has confirmado ningún plan. Sube una captura para empezar.</p>
      ) : (
        <div className="card">
          <table className="qtable">
            <thead>
              <tr><th scope="col">Quincena</th><th scope="col" className="num">Total</th></tr>
            </thead>
            <tbody>
              {schedule.rows.map((row) => (
                <tr key={row.index}>
                  <td>
                    {row.label}
                    {row.items.map((it) => (
                      <div key={it.key} className="small muted">
                        {it.provider} · {formatPesos(it.centavos)}
                        {it.simulated && <>{SIM}{NOT_SUMMED}</>}
                      </div>
                    ))}
                  </td>
                  <td className="num">{formatPesos(row.totalCentavos)}</td>
                </tr>
              ))}
              {schedule.undated.length > 0 && (
                <tr className="undated">
                  <td>
                    Sin fecha
                    {schedule.undated.map((u, i) => (
                      <div key={u.id ?? i} className="small muted">
                        {u.provider} · {u.totalCentavos === null ? "total desconocido" : `${formatPesos(u.totalCentavos)} en total`}
                        {u.simulated && SIM}
                        <br />Falta {u.missing.join(", ")}.
                      </div>
                    ))}
                  </td>
                  <td className="num muted">—</td>
                </tr>
              )}
            </tbody>
          </table>
          {schedule.beforeCentavos > 0 && (
            <p className="small muted" style={{ marginTop: 10 }}>
              Además, {formatPesos(schedule.beforeCentavos)} con fecha anterior a esta quincena. Revisa si ya los pagaste.
            </p>
          )}
          {schedule.afterCentavos > 0 && (
            <p className="small muted" style={{ marginTop: 6 }}>
              Y {formatPesos(schedule.afterCentavos)} más después de estas 6 quincenas.
            </p>
          )}
          {hasSimulated && (
            <p className="small muted" style={{ marginTop: 6 }}>
              Las líneas con {SIM} son datos de ejemplo, no leídos de tu captura, y no se suman en los totales.
            </p>
          )}
        </div>
      )}

      <p className="small muted" style={{ marginTop: 10 }}>
        Las compras a meses sin intereses (MSI) con tarjeta de crédito no están incluidas.
      </p>
      <p className="small muted" style={{ marginTop: 4 }}>Totales calculados con reglas fijas, no por la IA.</p>
    </section>
  );
}
