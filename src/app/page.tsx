import SignInButton from "./SignInButton";

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="shell">
      <span className="demo-tag">Datos inventados · demo</span>
      <h1>Lo que debes en tus apps de pagos a plazos, en un solo lugar</h1>
      <p className="sub">
        Sube una captura de la pantalla de pagos de cada app. Yo leo los datos, tú los confirmas y ves lo que
        vence en cada quincena. No guardo tus imágenes y no me conecto a tu banco.
      </p>
      <div className="card small muted">
        Esta es una demo de clase. Usa solo capturas inventadas, nunca las de tus apps reales.
      </div>
      <SignInButton />
      {error === "login" && <p className="banner error">No se pudo iniciar sesión. Intenta de nuevo.</p>}
    </main>
  );
}
