/*
  UDVIKLING OVER TID – vælg en spiller og en måling (mål, assists, skud % ...),
  og se en graf kamp for kamp.

  Grafen er tegnet med SVG direkte (ingen graf-bibliotek):
    - x-aksen: kampene i tidsrækkefølge (dato + modstander)
    - y-aksen: tallet for den valgte måling
    - antal (mål, assists, fejl) tegnes som SØJLER, procenter og tid som en LINJE
    - en stiplet gul linje viser gennemsnittet
  Hold musen over (eller tryk på) en kamp for at se det præcise tal.

  Bredden: vi måler, hvor bred boksen er (ResizeObserver), og tegner grafen i
  præcis den bredde. Så bliver teksten aldrig strakt eller klemt, og grafen
  passer både på en stor skærm og en telefon.
*/
import { useEffect, useRef, useState } from "react";
import { useData } from "../../DataKontekst.jsx";
import { formatDato, sorteretTrup } from "../../hjaelpere.js";
import { GRAF_MAALINGER, erTal, kampeAf, kampeITidsorden, muligeMaalinger } from "./beregning.js";

// Grafens højde og margener (plads til tal og tekst på akserne)
const HOEJDE = 260;
const MARGEN = { top: 16, hoejre: 16, bund: 46, venstre: 40 };

// "2026-11-01" → "1/11" (kort dato til x-aksen)
function kortDato(iso) {
  const [, maaned, dag] = String(iso ?? "").split("-");
  return dag && maaned ? `${Number(dag)}/${Number(maaned)}` : "?";
}

// Afkort lange holdnavne, så de kan være under søjlen
const afkort = (tekst, max) => (tekst.length > max ? tekst.slice(0, max - 1) + "…" : tekst);

/*
  Pæne tal på y-aksen: vi vil have ca. 4 streger med "runde" spring (1, 2, 5, 10, 20 ...).
  heltal = true: springet må ikke være under 1 (man kan ikke score et halvt mål).
*/
function paentTrin(maks, heltal) {
  const raa = maks / 4;
  const tiPotens = 10 ** Math.floor(Math.log10(raa));
  const n = raa / tiPotens;
  const trin = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * tiPotens;
  return heltal ? Math.max(1, trin) : trin;
}

/* ---------- Selve grafen ---------- */
function Graf({ punkter, maaling }) {
  const boksRef = useRef(null);
  const [bredde, setBredde] = useState(600);
  const [aktiv, setAktiv] = useState(null);      // index på den kamp man peger på (eller null)

  // Mål boksens bredde – og igen, hver gang den ændrer størrelse (fx når telefonen vendes)
  useEffect(() => {
    const el = boksRef.current;
    if (!el) return;
    const maal = () => setBredde(Math.max(260, Math.floor(el.clientWidth)));
    maal();
    const observator = new ResizeObserver(maal);
    observator.observe(el);
    return () => observator.disconnect();          // ryd op, når grafen forsvinder
  }, []);

  const plotBredde = bredde - MARGEN.venstre - MARGEN.hoejre;
  const plotHoejde = HOEJDE - MARGEN.top - MARGEN.bund;

  // Y-aksen: fra 0 til et pænt tal over det største. Procenter går altid til 100.
  const tal = punkter.map(p => p.vaerdi).filter(erTal);
  const stoerst = Math.max(0, ...tal);
  const trin = maaling.procent ? 25 : paentTrin(Math.max(stoerst, maaling.type === "soejle" ? 4 : 1), maaling.type === "soejle");
  const yMaks = maaling.procent ? 100 : Math.max(trin, Math.ceil(stoerst / trin) * trin);
  const yStreger = [];
  for (let v = 0; v <= yMaks + 1e-9; v += trin) yStreger.push(v);

  // Omregn fra tal til pixels. Hver kamp får en lige bred "kolonne" på x-aksen.
  const kolonne = plotBredde / punkter.length;
  const xAf = i => MARGEN.venstre + kolonne * (i + 0.5);
  const yAf = v => MARGEN.top + plotHoejde - (v / yMaks) * plotHoejde;

  // Hvor mange tekster kan der være på x-aksen? Vis hver 2./3./... hvis der er for mange.
  const hverN = Math.max(1, Math.ceil(punkter.length / Math.max(1, Math.floor(plotBredde / 58))));
  const visHold = kolonne >= 58;                     // holdnavnet kun når der er plads

  // Gennemsnittet af de kampe der har et tal
  const snit = tal.length ? tal.reduce((a, b) => a + b, 0) / tal.length : null;

  // Linjen: forbind punkterne der har et tal (kampe uden data springes over)
  const linjePunkter = punkter
    .map((p, i) => (erTal(p.vaerdi) ? `${xAf(i)},${yAf(p.vaerdi)}` : null))
    .filter(Boolean)
    .join(" ");

  const soejleBredde = Math.min(36, kolonne * 0.6);
  const aktivPunkt = aktiv != null ? punkter[aktiv] : null;

  // Info-boksens placering (holdes inden for grafen, så den ikke stikker ud i siden)
  const boksX = aktiv != null ? Math.min(bredde - 80, Math.max(80, xAf(aktiv))) : 0;
  const boksY = aktivPunkt && erTal(aktivPunkt.vaerdi) ? yAf(aktivPunkt.vaerdi) : MARGEN.top + plotHoejde;

  return (
    <div className="graf-boks" ref={boksRef} onPointerLeave={e => { if (e.pointerType === "mouse") setAktiv(null); }}>
      <svg
        className="graf"
        width={bredde}
        height={HOEJDE}
        viewBox={`0 0 ${bredde} ${HOEJDE}`}
        role="img"
        aria-label={`${maaling.navn} kamp for kamp`}
      >
        {/* Vandrette hjælpelinjer + tal på y-aksen */}
        {yStreger.map(v => (
          <g key={v}>
            <line className="graf-gitter" x1={MARGEN.venstre} x2={bredde - MARGEN.hoejre} y1={yAf(v)} y2={yAf(v)} />
            <text className="graf-akse-tal" x={MARGEN.venstre - 6} y={yAf(v)} textAnchor="end" dominantBaseline="middle">
              {maaling.procent ? v + "%" : Math.round(v * 10) / 10}
            </text>
          </g>
        ))}

        {/* Søjler eller linje */}
        {maaling.type === "soejle" ? (
          punkter.map((p, i) => erTal(p.vaerdi) && (
            <rect
              key={p.id}
              className={"graf-soejle" + (aktiv === i ? " aktiv" : "")}
              x={xAf(i) - soejleBredde / 2}
              y={yAf(p.vaerdi)}
              width={soejleBredde}
              height={Math.max(0, MARGEN.top + plotHoejde - yAf(p.vaerdi))}
              rx="3"
            />
          ))
        ) : (
          <>
            <polyline className="graf-linje" points={linjePunkter} />
            {punkter.map((p, i) => erTal(p.vaerdi) && (
              <circle key={p.id} className={"graf-prik" + (aktiv === i ? " aktiv" : "")} cx={xAf(i)} cy={yAf(p.vaerdi)} r={aktiv === i ? 6 : 4} />
            ))}
          </>
        )}

        {/* Gennemsnittet som en stiplet linje */}
        {snit != null && punkter.length > 1 && (
          <g>
            <line className="graf-snit" x1={MARGEN.venstre} x2={bredde - MARGEN.hoejre} y1={yAf(snit)} y2={yAf(snit)} />
            <text className="graf-snit-tekst" x={bredde - MARGEN.hoejre} y={yAf(snit) - 4} textAnchor="end">
              snit {maaling.format(Math.round(snit * 10) / 10).replace(".", ",")}
            </text>
          </g>
        )}

        {/* X-aksen: dato (og holdnavn, hvis der er plads) */}
        <line className="graf-akse" x1={MARGEN.venstre} x2={bredde - MARGEN.hoejre} y1={MARGEN.top + plotHoejde} y2={MARGEN.top + plotHoejde} />
        {punkter.map((p, i) => i % hverN === 0 && (
          <text key={p.id} className="graf-akse-tal" x={xAf(i)} y={MARGEN.top + plotHoejde + 16} textAnchor="middle">
            {kortDato(p.dato)}
            {visHold && <tspan x={xAf(i)} dy="14">{afkort(p.modstander, Math.floor(kolonne / 7))}</tspan>}
          </text>
        ))}

        {/* Usynlige felter over hver kamp – de fanger mus, tryk og tastatur (Tab) */}
        {punkter.map((p, i) => (
          <rect
            key={p.id}
            className="graf-fang"
            x={MARGEN.venstre + kolonne * i}
            y={MARGEN.top}
            width={kolonne}
            height={plotHoejde}
            tabIndex={0}
            aria-label={`${formatDato(p.dato)} mod ${p.modstander}: ${erTal(p.vaerdi) ? maaling.format(p.vaerdi) : "ingen data"}`}
            onPointerEnter={() => setAktiv(i)}
            onClick={() => setAktiv(i)}
            onFocus={() => setAktiv(i)}
            onBlur={() => setAktiv(null)}
          />
        ))}
      </svg>

      {/* Info-boksen med det præcise tal (almindelig HTML oven på grafen) */}
      {aktivPunkt && (
        <div className="graf-info" style={{ left: boksX, top: boksY }}>
          <b>{erTal(aktivPunkt.vaerdi) ? maaling.format(aktivPunkt.vaerdi) : "ingen data"}</b>
          <span>{formatDato(aktivPunkt.dato)}</span>
          <span>mod {aktivPunkt.modstander || "?"}</span>
        </div>
      )}
    </div>
  );
}

/* ---------- Kortet med valgene + grafen ---------- */
export default function Udvikling() {
  const { data } = useData();
  const trup = sorteretTrup(data.spillere);

  // Start med topscoreren (eller den første spiller med kampe)
  const [spillerId, setSpillerId] = useState(() => {
    const medKampe = trup.filter(s => kampeAf(s).length > 0);
    const top = [...medKampe].sort((a, b) =>
      kampeAf(b).reduce((t, k) => t + (Number(k.maal) || 0), 0) - kampeAf(a).reduce((t, k) => t + (Number(k.maal) || 0), 0))[0];
    return (top ?? trup[0])?.id ?? null;
  });
  const [maalingValg, setMaalingValg] = useState("maal");

  // Er den valgte spiller slettet imens? Så tager vi den første i truppen.
  const spiller = trup.find(s => s.id === spillerId) ?? trup[0] ?? null;
  const mulige = spiller ? muligeMaalinger(spiller) : ["maal"];
  // Har den nye spiller ikke data til målingen (fx spilletid)? Så viser vi mål.
  const maalingNoegle = mulige.includes(maalingValg) ? maalingValg : "maal";
  const maaling = GRAF_MAALINGER[maalingNoegle];

  const punkter = spiller
    ? kampeITidsorden(kampeAf(spiller)).map((k, i) => ({
        id: k.id ?? i,
        dato: k.dato,
        modstander: String(k.modstander ?? ""),
        vaerdi: maaling.vaerdi(k),
      }))
    : [];

  return (
    <div>
      <div className="felt-raekke stat-valg">
        <label className="felt">Spiller
          <select value={spiller?.id ?? ""} onChange={e => setSpillerId(Number(e.target.value))} disabled={!spiller}>
            {trup.map(s => <option key={s.id} value={s.id}>#{s.nummer} {s.navn} ({s.rolle})</option>)}
          </select>
        </label>
        <label className="felt">Måling
          <select value={maalingNoegle} onChange={e => setMaalingValg(e.target.value)}>
            {mulige.map(n => <option key={n} value={n}>{GRAF_MAALINGER[n].navn}</option>)}
          </select>
        </label>
      </div>

      {punkter.length === 0 ? (
        <p className="tom-tekst graf-tom">
          {spiller ? `${spiller.navn} har ingen kampe endnu. Kampe kommer fra Kampdag eller Spillere → Historik.` : "Der er ingen spillere endnu."}
        </p>
      ) : (
        // key: ny graf, når man skifter spiller eller måling (så info-boksen lukker)
        <Graf key={`${spiller.id}-${maalingNoegle}`} punkter={punkter} maaling={maaling} />
      )}
    </div>
  );
}
