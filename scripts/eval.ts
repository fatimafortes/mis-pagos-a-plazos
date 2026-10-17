// npm run eval — sends every invented screenshot in tests/fixtures to the real Gemini model
// and prints field accuracy and the count of invented values (PACKET §3).
// Always calls the real API (ignores SIMULATE_AI). Needs GEMINI_API_KEY in .env.local or the environment.
// Free tier: 5 requests/minute and 20/day for this model, so one run (8 calls) is paced.
// Quota (429) and service outages (503) stop the run with no result; timeouts count as failures.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { callGemini, GEMINI_MODEL } from "../src/lib/gemini";
import { parseModelOutput, type ExtractResult } from "../src/lib/extraction";
import { parseDate } from "../src/lib/quincenas";
import {
  SERVICE_ERROR_LABEL, TARGET_ACCURACY, classifyServiceError, scoreFixture, summarize, type ExpectedFixture,
} from "../src/lib/evalScore";

const root = resolve(import.meta.dirname, "..");
const fixtures = resolve(root, "tests/fixtures");

if (existsSync(resolve(root, ".env.local"))) process.loadEnvFile(resolve(root, ".env.local"));
if (!process.env.GEMINI_API_KEY) {
  console.error("Falta GEMINI_API_KEY (en .env.local o en el entorno).");
  process.exit(2);
}

const file = JSON.parse(readFileSync(resolve(fixtures, "expected.json"), "utf8")) as {
  reference_date: string;
  fixtures: Record<string, ExpectedFixture>;
};
const today = parseDate(file.reference_date);
if (!today) throw new Error(`reference_date no válida: ${file.reference_date}`);

const PACE_MS = 13_000; // stays under 5 requests per minute
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

console.log(`Modelo: ${GEMINI_MODEL} · fecha de referencia: ${file.reference_date}\n`);

const scores = [];
const entries = Object.entries(file.fixtures);
for (const [i, [name, expected]] of entries.entries()) {
  if (i > 0) await sleep(PACE_MS);
  const bytes = new Uint8Array(readFileSync(resolve(fixtures, name)));
  const started = Date.now();
  let result: ExtractResult;
  try {
    result = parseModelOutput(await callGemini(bytes, "image/png"), today);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const serviceError = classifyServiceError(msg);
    if (serviceError) {
      // Quota or outage says nothing about extraction quality: stop instead of scoring it as wrong.
      console.error(`\n${SERVICE_ERROR_LABEL[serviceError]} en ${name}.`);
      console.error(`Evaluación detenida: ${scores.length}/${entries.length} capturas evaluadas. Sin resultado.`);
      process.exit(2);
    }
    const reason = /abort/i.test(msg) ? "sin respuesta en el tiempo límite (timeout)" : `error de API: ${msg}`;
    console.log(`✗ ${name} — ${reason}`);
    result = { kind: "invalid_output" };
  }
  const s = scoreFixture(name, expected, result);
  scores.push(s);

  const ok = s.screenOk && s.invented.length === 0 && s.wrong.length === 0;
  const fields = s.fieldsTotal > 0 ? `${s.fieldsCorrect}/${s.fieldsTotal} campos` : (s.screenOk ? "rechazada" : "NO rechazada");
  console.log(`${ok ? "✓" : "✗"} ${name.padEnd(15)} ${expected.case.padEnd(62)} ${fields} · ${Date.now() - started} ms`);
  if (!s.screenOk) console.log(`    pantalla: esperado ${expected.is_payment_screen ? "planes" : "rechazo"}, obtenido ${result.kind}`);
  for (const w of s.wrong) console.log(`    incorrecto  ${w}`);
  for (const inv of s.invented) console.log(`    INVENTADO   ${inv}`);
}

const sum = summarize(scores);
const pct = (sum.accuracy * 100).toFixed(1);
console.log(`
Campos correctos:      ${sum.fieldsCorrect}/${sum.fieldsTotal} (${pct}%) · meta ≥ ${TARGET_ACCURACY * 100}%
Valores inventados:    ${sum.invented} · meta 0
Pantallas correctas:   ${sum.screensOk}/${sum.screensTotal} (planes extraídos o captura rechazada)
Resultado:             ${sum.passed ? "PASA" : "NO PASA"}`);

process.exit(sum.passed ? 0 : 1);
