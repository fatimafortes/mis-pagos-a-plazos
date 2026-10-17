import { formatPesos, quincenaSentence, type DueAlert, type Schedule } from "@/lib/quincenas";
import { COMPLETENESS_SHORT, type Completeness } from "@/lib/plans";

// The answer to "¿cuánto pago la próxima quincena?" at the top of the screen.
// Numbers come from buildSchedule (fixed rules); SIMULADO amounts are never in these totals.
export default function NextQuincenaCard({
  schedule,
  completeness,
  alerts,
}: {
  schedule: Schedule;
  completeness: Completeness;
  alerts: DueAlert[];
}) {
  const [current, next] = schedule.rows;
  const undatedReal = schedule.undated.filter((u) => !u.simulated).length;

  return (
    <section className="card next-q" aria-labelledby="next-q-title">
      <h2 id="next-q-title" className="small muted">Tu próxima quincena</h2>
      <p className="next-q-total">
        {quincenaSentence(next.index)} pagas <strong>{formatPesos(next.totalCentavos)}</strong>
      </p>
      <span className={`tag ${completeness === "complete_as_shown" ? "t-screenshot" : "t-warn"}`}>
        {COMPLETENESS_SHORT[completeness]}
      </span>
      <p className="small muted" style={{ marginTop: 8 }}>
        Esta quincena ({current.label}): {formatPesos(current.totalCentavos)}
      </p>
      {undatedReal > 0 && (
        <p className="small muted" style={{ marginTop: 2 }}>
          No incluye {undatedReal === 1 ? "1 plan sin fecha" : `${undatedReal} planes sin fecha`}.
        </p>
      )}
      {alerts.length > 0 && (
        <ul className="due-alerts">
          {alerts.map((a, i) => (
            <li key={i} className={`due-alert ${a.kind}`}>
              {a.kind === "today" ? `${a.provider} vence hoy` : `${a.provider} venció el ${a.date}`}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
