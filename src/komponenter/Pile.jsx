/*
  PILE – for løb (hel streg), afleveringer (stiplet hvid) og skud (stiplet gul).
  Bruges på Systemer-siden, ved afspilning på taktiktavlen og til tegning på tavlen.

  Matematikken (pilGeometri) og listen over et trins pile (trinPileListe) er "rene"
  funktioner, så videoen (systemer/videoEksport.js) kan tegne PRÆCIS de samme pile på et <canvas>.
*/
import { HJEMME } from "../data/konstanter.js";
import { angribereI, forsvarereI, rolleInfo } from "../systemRoller.js";
import { boldPunkt, erSkud, sammeBold } from "../animation.js";

/*
  Hvor skal pilen fra a til b tegnes? Giver { x1, y1, x2, y2, spids } – eller null,
  hvis pilen er for kort. slutAfstand = hvor langt før b pilen stopper
  (så den ikke gemmer sig under en figur). spids = trekantens 3 hjørner [[x, y], ...].
*/
export function pilGeometri(a, b, slutAfstand = 10) {
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
  const spids = [
    [x2 + ux * s, y2 + uy * s],
    [x2 - uy * s * 0.6, y2 + ux * s * 0.6],
    [x2 + uy * s * 0.6, y2 - ux * s * 0.6],
  ];
  return { x1, y1, x2, y2, spids };
}

// Én pil fra punkt a til punkt b (se pilGeometri)
export function Pil({ a, b, farve, stiplet = false, slutAfstand = 10 }) {
  const g = pilGeometri(a, b, slutAfstand);
  if (!g) return null;
  const { x1, y1, x2, y2 } = g;
  const spids = g.spids.map(p => p.join(",")).join(" ");
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
  Listen over pile fra ét trin til det næste: løb for vores spillere, der har flyttet sig,
  og en aflevering/skud hvis bolden har skiftet sted.
  Hver pil: { noegle, a, b, farve, stiplet, slutAfstand }. (Ren funktion – tegner ingenting.)
    forsvar = true → det er et forsvarssystem: så er det VORE forsvarsspillere, der får
                     løbepile (gule – målmanden grå), og ikke angriberne.
  Angriberne findes i selve trinet (angribereI), så en 7. angriber (ST2) også får pil.
*/
export function trinPileListe(fraTrin, tilTrin, forsvar = false) {
  if (!fraTrin || !tilTrin) return [];
  const loebere = forsvar ? forsvarereI(fraTrin) : angribereI(fraTrin);
  function loebFarve(noegle) {
    if (!forsvar) return rolleInfo(noegle).farve;
    return noegle === "M0" ? HJEMME.maalmand.farve : HJEMME.mark.farve;
  }
  const liste = [];
  for (const noegle of loebere) {
    const a = fraTrin.pos[noegle];
    const b = tilTrin.pos[noegle];
    if (a && b) liste.push({ noegle, a, b, farve: loebFarve(noegle), stiplet: false, slutAfstand: 10 });
  }
  if (!sammeBold(fraTrin.bold, tilTrin.bold)) {
    liste.push({
      noegle: "bold",
      a: boldPunkt(fraTrin.bold, fraTrin.pos),
      b: boldPunkt(tilTrin.bold, tilTrin.pos),
      farve: erSkud(tilTrin.bold) ? "#fde047" : "#ffffff",
      stiplet: true,
      slutAfstand: typeof tilTrin.bold === "string" ? 8 : 2,
    });
  }
  return liste;
}

// Alle pile fra ét trin til det næste som SVG (se trinPileListe)
export function TrinPile({ fraTrin, tilTrin, forsvar = false }) {
  if (!fraTrin || !tilTrin) return null;
  return (
    <>
      {trinPileListe(fraTrin, tilTrin, forsvar).map(p => (
        <Pil key={p.noegle} a={p.a} b={p.b} farve={p.farve} stiplet={p.stiplet} slutAfstand={p.slutAfstand} />
      ))}
    </>
  );
}

/*
  Et gennemsigtigt SVG-lag med samme koordinater som banen, til pile.
  viewBox (valgfri): banens viewBox som tekst – fx "-15 -30 230 460" til en hel bane.
*/
export function PileLag({ children, synlighed = 1, viewBox = "-15 -30 230 252" }) {
  return (
    <svg className="pile-lag" viewBox={viewBox} style={{ opacity: synlighed }}>
      {children}
    </svg>
  );
}
