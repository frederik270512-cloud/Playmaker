/*
  ANIMATION AF SYSTEMER – ren matematik, der bruges både på Systemer-siden
  og når et system afspilles på taktiktavlen.

  "tid" er HVOR i animationen vi er, målt i trin:
    tid = 0   → præcis på trin 1
    tid = 1.5 → halvvejs mellem trin 2 og trin 3
*/
import { MAAL } from "./data/konstanter.js";

/*
  "Easing" gør bevægelsen blød: langsom start, hurtig midte, langsom slutning.
  t går fra 0 til 1, og svaret går også fra 0 til 1 – bare ikke i lige linje.
*/
export function bloedBevaegelse(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/*
  Hvor står alle på tidspunktet "tid"?
  Mellem to trin "blander" vi positionerne: a + (b - a) * f  (lineær interpolation).
*/
export function tilstandVed(system, tid) {
  const trin = system.trin;
  const i = Math.max(0, Math.min(Math.floor(tid), trin.length - 1));   // trinet vi kommer FRA
  const fra = trin[i];
  const til = trin[i + 1];                                              // trinet vi skal TIL
  const raa = tid - i;                                                  // hvor langt vi er (0-1)

  if (!til || raa <= 0) {
    return { pos: fra.pos, boldFra: fra.bold, boldTil: fra.bold, f: 0, fraIndex: i };
  }
  // De første 15 % af hvert trin står alle stille et øjeblik
  const f = bloedBevaegelse(Math.max(0, (raa - 0.15) / 0.85));
  const pos = {};
  for (const noegle in fra.pos) {
    const a = fra.pos[noegle];
    const b = til.pos[noegle] || a;
    pos[noegle] = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
  }
  return { pos, boldFra: fra.bold, boldTil: til.bold, f, fraIndex: i };
}

/*
  Bolden kan være to ting:
    - en tekst, fx "C"        → spilleren har bolden (den sidder ved hans hånd)
    - et punkt, fx {x, y}     → bolden er kastet derhen (i målet = skud)
*/
export function boldPunkt(bold, pos) {
  if (typeof bold === "string") {
    const p = pos[bold];
    return p ? { x: p.x + 9, y: p.y + 3 } : { x: 100, y: 120 };
  }
  return bold;
}

// Hvor er bolden lige nu i animationen? (t = svaret fra tilstandVed)
export function boldPosition(t) {
  const a = boldPunkt(t.boldFra, t.pos);
  const b = boldPunkt(t.boldTil, t.pos);
  return { x: a.x + (b.x - a.x) * t.f, y: a.y + (b.y - a.y) * t.f };
}

// Er bolden i målet (= skud)?
export function erSkud(bold) {
  return typeof bold === "object" && bold !== null &&
         bold.x >= MAAL.venstre && bold.x <= MAAL.hoejre && bold.y <= MAAL.bund + 2;
}

// Har bolden samme placering i to trin?
export function sammeBold(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}
