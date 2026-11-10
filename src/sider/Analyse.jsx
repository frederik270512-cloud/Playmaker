/*
  SIDE 8: ANALYSE – heatmap + forslag.

  Venstre kort:  🔥 Heatmap over jeres systemer (løb, afleveringer eller skud)
  Højre kort:    🧠 Forslag mod modstanderens forsvar: bedste systemer + hvad I kan gøre bedre

  Al "intelligens" er regler i analyse/forslag.js, og heatmappet regnes ud i analyse/heatmap.js.
  Siden LÆSER kun data – den ændrer ingenting.
*/
import { useMemo, useState } from "react";
import { useData } from "../DataKontekst.jsx";
import { useNavigation } from "../Navigation.jsx";
import BaneSVG from "../komponenter/BaneSVG.jsx";
import { bygHeatmap, angrebssystemer, TYPER, CELLE, ANTAL } from "./analyse/heatmap.js";
import { rangerSystemer, forbedringer, FORSVARS_VIDEN } from "./analyse/forslag.js";
import "./Analyse.css";

/*
  Farven for et felt: 0 = gennemsigtig, 1 = varmest.
  Går fra blå → grøn → gul → rød (som et vejr-kort).
*/
function varmeFarve(v) {
  const hue = 220 - 220 * v;                  // 220 = blå, 0 = rød
  return `hsla(${hue}, 100%, 55%, ${0.35 + 0.6 * v})`;
}

function Heatmap({ systemer, type }) {
  const { gitter, max, antal } = useMemo(() => bygHeatmap(systemer, type), [systemer, type]);
  return (
    <>
      <div className="analyse-bane">
        <BaneSVG />
        <svg className="analyse-varme" viewBox="-15 -30 230 252">
          <defs>
            {/* Sløring, så felterne flyder sammen til "varme-skyer" */}
            <filter id="varme-slør" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="5" />
            </filter>
            <clipPath id="varme-klip"><rect x="0" y="0" width="200" height="200" /></clipPath>
          </defs>
          <g filter="url(#varme-slør)" clipPath="url(#varme-klip)">
            {max > 0 && gitter.flatMap((raekke, r) => raekke.map((v, k) => v > 0 && (
              <rect key={`${r}-${k}`} x={k * CELLE - 2} y={r * CELLE - 2} width={CELLE + 4} height={CELLE + 4}
                    fill={varmeFarve(Math.sqrt(v / max))} />
            )))}
          </g>
        </svg>
        {max === 0 && <div className="analyse-tom">Ingen {TYPER[type].navn.slice(2).toLowerCase()} i de valgte systemer</div>}
      </div>
      <div className="varme-skala">
        <span>Lidt</span><div className="varme-gradient" /><span>Meget</span>
        <small>{antal} {type === "loeb" ? "løb" : type === "afl" ? "afleveringer" : "skud"} talt med</small>
      </div>
      <p className="opsummering" style={{ marginTop: 6 }}>
        Grundlag: {ANTAL}×{ANTAL} felter á 1×1 m. Systemer med varianter tæller alle varianter (vægtet ligeligt).
      </p>
    </>
  );
}

export default function Analyse() {
  const { data } = useData();
  const { skiftSide } = useNavigation();
  const alleSystemer = useMemo(() => angrebssystemer(data.systemer), [data.systemer]);

  // Valg øverst
  const [modstanderId, setModstanderId] = useState("");
  const modstander = data.modstandere.find(h => String(h.id) === modstanderId) || null;
  const [egetForsvar, setEgetForsvar] = useState("6-0");
  // Har modstanderen et kendt forsvar, bruges det – ellers det man selv vælger
  const forsvar = modstander?.forsvar || egetForsvar;

  const [type, setType] = useState("loeb");
  const [kunMod, setKunMod] = useState(false);       // kun systemer lavet mod forsvaret?
  const [systemId, setSystemId] = useState("alle");

  const valgteSystemer = useMemo(() => {
    let liste = kunMod ? alleSystemer.filter(s => s.forsvar === forsvar) : alleSystemer;
    if (systemId !== "alle") liste = liste.filter(s => String(s.id) === systemId);
    return liste;
  }, [alleSystemer, kunMod, forsvar, systemId]);

  const rangering = useMemo(() => rangerSystemer(data.systemer, forsvar), [data.systemer, forsvar]);
  const raad = useMemo(() => forbedringer(data, forsvar, modstander), [data, forsvar, modstander]);
  const viden = FORSVARS_VIDEN[forsvar];
  const topPoint = rangering[0]?.point || 1;

  return (
    <main className="side side-analyse">
      {/* ---------- Valg ---------- */}
      <section className="kort analyse-kort analyse-bred analyse-valg">
        <label className="felt">🆚 Modstander
          <select value={modstanderId} onChange={e => setModstanderId(e.target.value)}>
            <option value="">– Ingen bestemt –</option>
            {data.modstandere.map(h => <option key={h.id} value={String(h.id)}>{h.navn || "Uden navn"}</option>)}
          </select>
        </label>
        <label className="felt">🛡️ Deres forsvar
          {modstander?.forsvar ? (
            <div className="analyse-fast">{modstander.forsvar} <small>(fra Oversigt)</small></div>
          ) : (
            <select value={egetForsvar} onChange={e => setEgetForsvar(e.target.value)}>
              {Object.keys(FORSVARS_VIDEN).map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          )}
        </label>
        <p className="opsummering analyse-forklaring">
          🧠 Analysen laves af regler i appen ud fra jeres systemer, statistik fra Kampdag og håndbold-viden om forsvaret.
          Den virker uden internet.
        </p>
      </section>

      {/* ---------- Heatmap ---------- */}
      <section className="kort analyse-kort">
        <div className="liste-top">
          <div>
            <h2>🔥 Heatmap</h2>
            <p className="opsummering">{TYPER[type].tekst} – ud fra {valgteSystemer.length} angrebssystem{valgteSystemer.length === 1 ? "" : "er"}.</p>
          </div>
        </div>
        <div className="analyse-knapper">
          {Object.entries(TYPER).map(([id, t]) => (
            <button key={id} className={"knap knap-lille" + (type === id ? " knap-primaer" : "")} onClick={() => setType(id)}>
              {t.navn}
            </button>
          ))}
        </div>
        <div className="analyse-filter">
          <select value={systemId} onChange={e => setSystemId(e.target.value)}>
            <option value="alle">Alle systemer</option>
            {alleSystemer.map(s => <option key={s.id} value={String(s.id)}>{s.navn}</option>)}
          </select>
          <label className="analyse-tjek">
            <input type="checkbox" checked={kunMod} onChange={e => setKunMod(e.target.checked)} />
            Kun systemer mod {forsvar}
          </label>
        </div>
        <Heatmap systemer={valgteSystemer} type={type} />
      </section>

      {/* ---------- Forslag ---------- */}
      <section className="kort analyse-kort">
        <div className="liste-top">
          <div>
            <h2>🧠 Forslag mod {forsvar}{modstander ? ` · ${modstander.navn}` : ""}</h2>
            {viden && <p className="opsummering">{viden.beskrivelse}</p>}
          </div>
        </div>

        <h4>🏆 Jeres bedste systemer mod {forsvar}</h4>
        {rangering.length === 0 ? (
          <p className="opsummering">I har ingen angrebssystemer endnu.</p>
        ) : (
          <ol className="analyse-rang">
            {rangering.slice(0, 5).map(({ system, point, grunde }) => (
              <li key={system.id}>
                <div className="rang-top">
                  <button className="link-knap" title="Åbn på Systemer-siden"
                          onClick={() => skiftSide("systemer")}>
                    {system.navn}
                  </button>
                  <span className="rang-point">{point} p</span>
                </div>
                <div className="rang-bjaelke"><div style={{ width: `${Math.max(4, (point / topPoint) * 100)}%` }} /></div>
                <small>{grunde.length ? grunde.join(" · ") : "Ingen særlige styrker mod dette forsvar"}</small>
              </li>
            ))}
          </ol>
        )}

        {viden && (
          <>
            <h4>💡 Det virker typisk mod {forsvar}</h4>
            <ul className="analyse-tips">
              {viden.tips.map(t => <li key={t}>{t}</li>)}
            </ul>
          </>
        )}

        <h4>📈 Det kan I gøre bedre</h4>
        <div className="analyse-raad">
          {raad.map((r, i) => (
            <div key={i} className={"raad" + (r.vigtig ? " raad-vigtig" : "")}>
              <span className="raad-ikon">{r.ikon}</span>
              <div><strong>{r.titel}</strong><p>{r.tekst}</p></div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
