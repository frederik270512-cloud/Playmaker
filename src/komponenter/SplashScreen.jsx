/*
  SPLASH SCREEN – forsiden, der vises lige når appen åbnes.

  Animationen fortæller en lille historie (alt styres af CSS i SplashScreen.css):
    0,0 s  banens linjer (6 m, 9 m og målet) tegner sig selv op
    0,3 s  tre spillere dukker op, og afleveringspile tegnes mellem dem
    0,6 s  bolden flyver langs afleveringerne og bliver skudt i mål
    1,5 s  MÅL! – lysglimt, chokbølger og gnister ud fra målet
    1,6 s  "Playmaker" slår ind bogstav for bogstav, og et lysskær glider hen over teksten
    3,0 s  hele forsiden fader ud (0,6 s) og fjerner sig selv

  Brug:  <SplashScreen />  øverst i App – den lægger sig ovenpå alt andet.
  Props: varighed (ms, standard 3000) og onFaerdig (kaldes når den er væk).
*/
import { useEffect, useState } from "react";
import "./SplashScreen.css";

const UDTONING = 600;                       // hvor lang tid fade-out tager (ms) – skal passe med CSS
const TITEL = "Playmaker";
// Gnister der skydes ud fra målet: vinkel (grader) og længde
const GNISTER = Array.from({ length: 14 }, (_, i) => ({ vinkel: i * (360 / 14), laengde: 60 + (i % 3) * 25 }));

export default function SplashScreen({ varighed = 3000, onFaerdig }) {
  // "vis" → "udtoner" → "vaek"
  const [fase, setFase] = useState("vis");

  useEffect(() => {
    const t1 = setTimeout(() => setFase("udtoner"), varighed);
    const t2 = setTimeout(() => { setFase("vaek"); onFaerdig?.(); }, varighed + UDTONING);
    return () => { clearTimeout(t1); clearTimeout(t2); };      // ryd op, hvis komponenten forsvinder før tid
  }, [varighed, onFaerdig]);

  if (fase === "vaek") return null;

  return (
    <div className={"splash" + (fase === "udtoner" ? " splash-ud" : "")}
         style={{ "--splash-varighed": `${varighed}ms` }}
         role="status" aria-label="Playmaker indlæses">

      {/* ---------- Taktik-scenen: bane, spillere, afleveringer og skud ---------- */}
      <svg className="splash-scene" viewBox="0 0 300 200" aria-hidden="true">
        {/* Banens linjer (tegnes op med stroke-dashoffset) */}
        <path className="s-linje" pathLength="1" d="M60 20 Q60 80 150 80 Q240 80 240 20" />
        <path className="s-linje s-ni" pathLength="1" d="M30 20 Q30 115 150 115 Q270 115 270 20" />
        <path className="s-maal" pathLength="1" d="M130 20 L130 8 L170 8 L170 20" />

        {/* Spillerne (VB, PM, HB) */}
        <circle className="s-spiller" style={{ "--f": "0.30s" }} cx="70"  cy="160" r="7" />
        <circle className="s-spiller" style={{ "--f": "0.38s" }} cx="150" cy="175" r="7" />
        <circle className="s-spiller" style={{ "--f": "0.46s" }} cx="230" cy="160" r="7" />

        {/* Afleveringspile: VB → PM → HB → skud */}
        <path className="s-pil" style={{ "--f": "0.55s" }} pathLength="1" d="M70 160 Q110 185 150 175" />
        <path className="s-pil" style={{ "--f": "0.80s" }} pathLength="1" d="M150 175 Q190 185 230 160" />
        <path className="s-pil s-skud" style={{ "--f": "1.05s" }} pathLength="1" d="M230 160 Q200 60 150 14" />

        {/* Bolden følger samme vej som pilene */}
        <circle className="s-bold" r="5" />

        {/* MÅL-eksplosion */}
        <g className="s-boom" transform="translate(150 14)">
          <circle className="s-boelge" r="10" />
          <circle className="s-boelge s-boelge2" r="10" />
          {GNISTER.map((g, i) => (
            <line key={i} className="s-gnist" x1="0" y1="0" x2="0" y2={-g.laengde}
                  transform={`rotate(${g.vinkel})`} style={{ "--i": i }} />
          ))}
        </g>
      </svg>
      <div className="splash-glimt" />

      {/* ---------- Logo-teksten ---------- */}
      <div className="splash-indhold">
        <h1 className="splash-titel" aria-label={TITEL}>
          {TITEL.split("").map((b, i) => (
            <span key={i} className={i >= 4 ? "orange" : ""} style={{ "--i": i }}>{b}</span>
          ))}
        </h1>
        <p className="splash-undertitel">Taktik &amp; Kampstyring</p>
      </div>

      {/* Lille progress-bar i bunden – fylder op på præcis "varighed" */}
      <div className="splash-loader"><div /></div>
    </div>
  );
}
