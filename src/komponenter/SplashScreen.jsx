/*
  SPLASH SCREEN – forsiden, der vises lige når appen åbnes.

  Forløb (alt styres af CSS-animationer i SplashScreen.css):
    0,0 s  logo + tekst fader blødt ind og zoomer let op, progress-baren begynder at fylde
    3,0 s  hele forsiden fader ud (0,6 s)
    3,6 s  komponenten fjerner sig selv helt, så hovedappen kan bruges

  Brug:  <SplashScreen />  øverst i App – den lægger sig ovenpå alt andet.
  Props: varighed (ms, standard 3000) og onFaerdig (kaldes når den er væk).
*/
import { useEffect, useState } from "react";
import "./SplashScreen.css";

const UDTONING = 600;      // hvor lang tid fade-out tager (ms) – skal passe med CSS

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
      <div className="splash-indhold">
        {/* Håndbolden: roterer langsomt, mens en orange ring pulserer bagved */}
        <div className="splash-logo">
          <span className="splash-puls" />
          <svg className="splash-bold" viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r="46" fill="#fff" />
            {/* Bolden "sømme" i orange og gul */}
            <path d="M50 4 C30 25 30 75 50 96" stroke="#f97316" strokeWidth="5" fill="none" />
            <path d="M50 4 C70 25 70 75 50 96" stroke="#f97316" strokeWidth="5" fill="none" />
            <path d="M6 38 C30 48 70 48 94 38" stroke="#facc15" strokeWidth="5" fill="none" />
            <path d="M6 62 C30 52 70 52 94 62" stroke="#facc15" strokeWidth="5" fill="none" />
            <circle cx="50" cy="50" r="46" fill="none" stroke="#1C2541" strokeWidth="3" />
          </svg>
        </div>
        <h1 className="splash-titel">Play<span>maker</span></h1>
        <p className="splash-undertitel">Taktik &amp; Kampstyring</p>
      </div>

      {/* Lille progress-bar i bunden – fylder op på præcis "varighed" */}
      <div className="splash-loader"><div /></div>
    </div>
  );
}
