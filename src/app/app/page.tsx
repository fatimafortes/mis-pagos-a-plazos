import { redirect } from "next/navigation";
import { currentUser } from "@/lib/supabase/server";
import { buildSchedule } from "@/lib/quincenas";
import { todayInMexico } from "@/lib/extraction";
import { COMPLETENESS, SAVED_PLAN_COLUMNS, rowToSavedPlan, type Completeness } from "@/lib/plans";
import UploadForm from "./UploadForm";
import QuincenaResults from "./QuincenaResults";
import CompletenessQuestion from "./CompletenessQuestion";
import SavedPlanCard from "./SavedPlanCard";

export const dynamic = "force-dynamic";

export default async function AppPage() {
  const { supabase, user } = await currentUser();
  if (!user) redirect("/");

  // RLS returns only this user's rows.
  const [plansRes, statusRes] = await Promise.all([
    supabase.from("w10_payment_plans").select(SAVED_PLAN_COLUMNS).order("confirmed_at", { ascending: true }),
    supabase.from("w10_ledger_status").select("completeness").maybeSingle(),
  ]);
  if (plansRes.error) console.error("[app] leer planes falló:", { code: plansRes.error.code, message: plansRes.error.message });
  if (statusRes.error) console.error("[app] leer estado falló:", { code: statusRes.error.code, message: statusRes.error.message });

  const plans = (plansRes.data ?? []).map(rowToSavedPlan);
  const stored = statusRes.data?.completeness as Completeness | undefined;
  const completeness: Completeness = stored && COMPLETENESS.includes(stored) ? stored : "incomplete";
  const schedule = buildSchedule(plans, todayInMexico());

  return (
    <main className="shell">
      <span className="demo-tag">Datos inventados · demo</span>
      <h1>Hola</h1>
      <p className="sub">Sesión iniciada como {user.email}.</p>
      <UploadForm />
      {plansRes.error ? (
        <p className="banner error">No pude cargar tus planes guardados. Recarga la página.</p>
      ) : (
        <>
          <QuincenaResults schedule={schedule} completeness={completeness} planCount={plans.length} />
          <CompletenessQuestion current={completeness} />
          {plans.length > 0 && (
            <section aria-labelledby="saved-title">
              <h2 id="saved-title" style={{ marginTop: 24 }}>Tus planes guardados</h2>
              <p className="small muted" style={{ marginTop: 4 }}>Puedes borrar cualquiera. Solo tú los ves.</p>
              {plans.map((p) => <SavedPlanCard key={p.id} plan={p} />)}
            </section>
          )}
        </>
      )}
      <form action="/auth/signout" method="post" style={{ marginTop: 16 }}>
        <button className="btn" type="submit">Cerrar sesión</button>
      </form>
    </main>
  );
}
