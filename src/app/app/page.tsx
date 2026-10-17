import { redirect } from "next/navigation";
import { currentUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AppPage() {
  const { user } = await currentUser();
  if (!user) redirect("/");

  return (
    <main className="shell">
      <span className="demo-tag">Datos inventados · demo</span>
      <h1>Hola</h1>
      <p className="sub">Sesión iniciada como {user.email}.</p>
      <form action="/auth/signout" method="post">
        <button className="btn" type="submit">Cerrar sesión</button>
      </form>
    </main>
  );
}
