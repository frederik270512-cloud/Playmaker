/*
  PILE – for løb (hel streg), afleveringer (stiplet hvid) og skud (stiplet gul).
  Bruges på Systemer-siden, ved afspilning på taktiktavlen og til tegning på tavlen.
*/
import { HJEMME } from "../data/konstanter.js";
import { angribereI, forsvarereI, rolleInfo } from "../systemRoller.js";
import { boldPunkt, erSkud, sammeBold } from "../animation.js";

/*
  Én pil fra punkt a til punkt b. slutAfstand = hvor langt før b pilen stopper
  (så den ikke gemmer sig under en figur). Giver null, hvis pilen er for kort.
*/
export function Pil({ a, b, farve, stiplet = false, slutAfstand = 10 }) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const laengde = Math.hypot(dx, dy);          // afstanden (Pythagoras)
  if (laengde < 8) return null;

  const ux = dx / laengde;                     // retningen som "enhedsvektor" (længde 1)
  const uy = dy / laengde;
  const kort = Math.min(slutAfstand, laengde / 3);
  const x1 = a.x + ux * 5, y1 = a.y + uy * 5;
  const x2 = b.x - ux * kort, y2 = b.y - uy * kort;

  // Pilespidsen: en trekant. (-uy, ux) er retningen vinkelret på pilen.
  const s = 4;
  const spids = `${x2 + ux * s},${y2 + uy * s} ${x2 - uy * s * 0.6},${y2 + ux * s * 0.6} ${x2 + uy * s * 0.6},${y2 - ux * s * 0.6}`;
  const streg = stiplet ? "3 2.5" : undefined;

  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#0f172a" strokeWidth="3.2"
            strokeLinecap="round" strokeDasharray={streg} opacity="0.6" />
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={farve} strokeWidth="1.6"
            strokeLinecap="round" strokeDasharray={streg} />
      <polygon points={spids} fill={farve} stroke="#0f172a" strokeWidth="0.6" />
    </g>
  );
}

/*
  Alle pile fra ét trin til det næste: løb for vores spillere, der har flyttet sig,
  og en aflevering/skud hvis bolden har skiftet sted.
    forsvar = true → det er et forsvarssystem: så er det VORE forsvarsspillere, der får
                     løbepile (gule – målmanden grå), og ikke angriberne.
  Angriberne findes i selve trinet (angribereI), så en 7. angriber (ST2) også får pil.
*/
export function TrinPile({ fraTrin, tilTrin, forsvar = false }) {
  if (!fraTrin || !tilTrin) return null;
  const skud = erSkud(tilTrin.bold);
  const loebere = forsvar ? forsvarereI(fraTrin) : angribereI(fraTrin);
  function loebFarve(noegle) {
    if (!forsvar) return rolleInfo(noegle).farve;
    return noegle === "M0" ? HJEMME.maalmand.farve : HJEMME.mark.farve;
  }
  return (
    <>
      {loebere.map((noegle) => {
        const a = fraTrin.pos[noegle];
        const b = tilTrin.pos[noegle];
        return a && b ? <Pil key={noegle} a={a} b={b} farve={loebFarve(noegle)} /> : null;
      })}
      {!sammeBold(fraTrin.bold, tilTrin.bold) && (
        <Pil
          a={boldPunkt(fraTrin.bold, fraTrin.pos)}
          b={boldPunkt(tilTrin.bold, tilTrin.pos)}
          farve={skud ? "#fde047" : "#ffffff"}
          stiplet
          slutAfstand={typeof tilTrin.bold === "string" ? 8 : 2}
        />
      )}
    </>
  );
}

// Et gennemsigtigt SVG-lag med samme koordinater som banen, til pile
export function PileLag({ children, synlighed = 1 }) {
  return (
    <svg className="pile-lag" viewBox="-15 -30 230 252" style={{ opacity: synlighed }}>
      {children}
    </svg>
  );
}
