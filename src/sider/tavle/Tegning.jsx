/*
  TEGN PÅ TAVLEN – et gennemsigtigt SVG-lag oven på banen + en lille værktøjslinje.

  Hver streg gemmes i data.tegning som { type, farve, punkter } i banens koordinater,
  så tegningen passer, uanset hvor stor banen er på skærmen.
    "fri" = frihånd: mange punkter efter musen/fingeren
    "pil" = kun start- og slutpunkt, tegnes med pilespids

  Props:
    aktiv          – er "✏️ Tegn" slået til?
    vaerktoej      – "fri", "pil" eller "visk" (viskelæder)
    setVaerktoej   – skift værktøj (staten bor i Taktiktavle, fordi banen skal have klassen "visker")
    helBane        – viser tavlen hel bane? Så bruger tegnelaget den hele banes viewBox
*/
import { useRef, useState } from "react";
import { useData } from "../../DataKontekst.jsx";
import { useDialog } from "../../komponenter/Dialog.jsx";
import { Pil } from "../../komponenter/Pile.jsx";
import { skaermTilBaneI, baneViewBox, viewBoxTekst } from "../../hjaelpere.js";

const FARVER = [
  { farve: "#ffffff", navn: "Hvid" },
  { farve: "#fde047", navn: "Gul" },
  { farve: "#ef4444", navn: "Rød" },
  { farve: "#22d3ee", navn: "Turkis" },
];

const VAERKTOEJER = [
  { id: "fri",  ikon: "✏️", titel: "Frihånd" },
  { id: "pil",  ikon: "➜",  titel: "Pil (træk fra start til slut)" },
  { id: "visk", ikon: "🧽", titel: "Viskelæder – klik på en streg" },
];

/*
  Én streg som SVG. "ramme" er en usynlig, bred kopi af stregen,
  så viskelæderet er let at ramme (CSS gør den klikbar i viske-tilstand).
*/
function Streg({ streg, index }) {
  if (streg.type === "pil") {
    const a = streg.punkter[0];
    const b = streg.punkter[streg.punkter.length - 1];
    return (
      <g data-index={index}>
        <Pil a={a} b={b} farve={streg.farve} slutAfstand={0} />
        <line className="ramme" x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth="8" />
      </g>
    );
  }
  const punkter = streg.punkter.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  return (
    <g data-index={index}>
      <polyline points={punkter} fill="none" stroke="#0f172a" strokeWidth="3.4" opacity="0.5"
                strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={punkter} fill="none" stroke={streg.farve} strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round" />
      <polyline className="ramme" points={punkter} fill="none" stroke="transparent" strokeWidth="8" />
    </g>
  );
}

export default function Tegning({ aktiv, vaerktoej, setVaerktoej, helBane = false }) {
  const vb = baneViewBox(helBane);   // halv eller hel bane
  const { data, opdater } = useData();
  const { bekraeftSlet } = useDialog();
  const [farve, setFarve] = useState("#ffffff");

  /*
    Stregen man er i gang med at tegne. Den gemmes først i data, når man slipper
    (så vi ikke gemmer i hukommelsen ved hver eneste musebevægelse).
    Vi har den både i en ref (altid den nyeste – bruges i event-handlerne)
    og i state (så React tegner den på skærmen).
  */
  const stregRef = useRef(null);
  const [streg, setStreg] = useState(null);

  function saetStreg(ny) {
    stregRef.current = ny;
    setStreg(ny);
  }

  function trykNed(e) {
    if (!aktiv) return;
    // Viskelæder: fjern den streg man klikker på
    if (vaerktoej === "visk") {
      const gruppe = e.target.closest("g[data-index]");
      if (gruppe) {
        const index = Number(gruppe.dataset.index);
        opdater(d => { d.tegning.splice(index, 1); });
      }
      return;
    }
    e.preventDefault();
    // "Pointer capture": alle bevægelser sendes til laget, også hvis man kommer uden for det
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ikke afgørende – virker også uden */ }
    const p = skaermTilBaneI(vb, e.currentTarget, e.clientX, e.clientY);
    saetStreg({ type: vaerktoej, farve, punkter: [p, p] });
  }

  function bevaeg(e) {
    const s = stregRef.current;
    if (!s) return;
    const p = skaermTilBaneI(vb, e.currentTarget, e.clientX, e.clientY);
    let punkter;
    if (s.type === "pil") {
      punkter = [s.punkter[0], p];                       // en pil har kun start og slut
    } else {
      const sidste = s.punkter[s.punkter.length - 1];
      // Gem kun et nyt punkt, når man har flyttet sig lidt (færre punkter = mindre data)
      if (Math.hypot(p.x - sidste.x, p.y - sidste.y) <= 1) return;
      punkter = [...s.punkter, p];
    }
    // Vi laver et NYT objekt i stedet for at rette i det gamle – så opdager React ændringen
    saetStreg({ ...s, punkter });
  }

  function slip() {
    const s = stregRef.current;
    if (!s) return;
    saetStreg(null);
    const a = s.punkter[0];
    const b = s.punkter[s.punkter.length - 1];
    // Et lille klik uden bevægelse bliver ikke til en streg
    if (s.punkter.length > 2 || Math.hypot(b.x - a.x, b.y - a.y) > 3) {
      opdater(d => { d.tegning.push(s); });
    }
  }

  // Bliver tegningen afbrudt (fx af systemet på en tablet), smider vi den halve streg væk
  function afbrudt() {
    saetStreg(null);
  }

  async function rydAlt() {
    if (data.tegning.length === 0) return;
    if (!(await bekraeftSlet("Ryd tegningen?", `Alle ${data.tegning.length} streger på tavlen bliver slettet.`))) return;
    opdater(d => { d.tegning = []; });
  }

  return (
    <>
      {/* Tegnelaget: samme viewBox som banen, så tegningen skalerer med */}
      <svg
        className="tegne-lag"
        viewBox={viewBoxTekst(vb)}
        onPointerDown={trykNed}
        onPointerMove={bevaeg}
        onPointerUp={slip}
        onPointerCancel={afbrudt}
      >
        {/* key={i}: React skal bruge en "nøgle" for hvert element i en liste */}
        {data.tegning.map((s, i) => <Streg key={i} streg={s} index={i} />)}
        {streg && <Streg streg={streg} index={-1} />}
      </svg>

      {/* Værktøjslinjen – vises kun når "✏️ Tegn" er slået til */}
      <div className="tegne-vaerktoej" hidden={!aktiv}>
        {VAERKTOEJER.map(v => (
          <button
            key={v.id}
            className={"vaerktoej" + (vaerktoej === v.id ? " aktiv" : "")}
            title={v.titel}
            onClick={() => setVaerktoej(v.id)}
          >
            {v.ikon}
          </button>
        ))}
        <span className="skille"></span>
        {FARVER.map(f => (
          <button
            key={f.farve}
            className={"farve" + (farve === f.farve ? " aktiv" : "")}
            style={{ background: f.farve }}
            title={f.navn}
            onClick={() => setFarve(f.farve)}
          />
        ))}
        <span className="skille"></span>
        <button className="vaerktoej" title="Fortryd sidste streg" onClick={() => opdater(d => { d.tegning.pop(); })}>↶</button>
        <button className="vaerktoej" title="Ryd hele tegningen" onClick={rydAlt}>🗑</button>
      </div>
    </>
  );
}
