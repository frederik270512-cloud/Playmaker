/*
  PLAN-EDITOR – felterne man udfylder kampplanen med.
  Alt gemmes med det samme (ligesom på Oversigt): hver ændring kalder saetFelt(),
  som Kampplan.jsx sender med som prop.
*/
import { useData } from "../../DataKontekst.jsx";
import MiniBane from "../systemer/MiniBane.jsx";
import { formatDato, idagISO } from "../../hjaelpere.js";
import { autoTitel, lavSnapshot } from "./kampplanHjaelpere.js";

export default function PlanEditor({ plan, modstander, saetFelt }) {
  const { data } = useData();

  /* ---------- Startopstilling: tag et øjebliksbillede ---------- */
  function brugTavlen() {
    saetFelt("opstilling", lavSnapshot(`Taktiktavlen (${formatDato(idagISO())})`,
      data.opstilling, data.pladsPositioner));
  }

  // Værdien fra en <select> er altid tekst – derfor sammenligner vi med String(...)
  function brugGemt(id) {
    const gemt = data.opstillinger.find(o => String(o.id) === id);
    if (!gemt) return;
    saetFelt("opstilling", lavSnapshot(`Gemt opstilling "${gemt.navn}"`, gemt.opstilling, gemt.pladsPositioner));
  }

  /* ---------- Systemer: sæt/fjern flueben ---------- */
  function skiftSystem(id) {
    const valgt = plan.systemIds.includes(id);
    saetFelt("systemIds", valgt ? plan.systemIds.filter(x => x !== id) : [...plan.systemIds, id]);
  }

  // Valgte systemer der ikke findes længere (slettet på Systemer-siden)
  const slettede = plan.systemIds.filter(id => !data.systemer.some(s => s.id === id));
  const antalPaaBanen = plan.opstilling
    ? Object.values(plan.opstilling.spillere).filter(id => data.spillere.some(s => s.id === id)).length
    : 0;

  return (
    <div className="kp-editor-felter">
      <label className="felt">Titel
        <input type="text" maxLength={60} placeholder={autoTitel(modstander)}
               value={plan.titel} onChange={e => saetFelt("titel", e.target.value)} />
      </label>

      <div className="felt-raekke">
        <label className="felt">Dato
          <input type="date" value={plan.dato} onChange={e => saetFelt("dato", e.target.value)} />
        </label>
        <label className="felt">Modstander
          <select
            value={modstander ? String(modstander.id) : ""}
            onChange={e => {
              const h = data.modstandere.find(x => String(x.id) === e.target.value);
              saetFelt("modstanderId", h ? h.id : null);
            }}
          >
            <option value="">Ingen</option>
            {data.modstandere.map(h => (
              <option key={h.id} value={String(h.id)}>{h.navn || "Unavngivet hold"}</option>
            ))}
          </select>
        </label>
      </div>
      {plan.modstanderId != null && !modstander && (
        <p className="kp-advarsel">Holdet, der var valgt, er blevet slettet under Oversigt.</p>
      )}

      <h3>🤾 Startopstilling</h3>
      <p className="hjaelp">
        {plan.opstilling
          ? `${antalPaaBanen}/7 spillere · fra ${plan.opstilling.kilde || "ukendt"}`
          : "Ingen opstilling valgt endnu."}
      </p>
      <div className="kp-opstilling-knapper">
        <button className="knap knap-lille" onClick={brugTavlen} title="Tag en kopi af det, der står på taktiktavlen lige nu">
          📸 Brug nuværende tavle
        </button>
        {/* value="" hele tiden: listen er bare en "vælg og hent"-knap */}
        <select className="kp-select" value="" onChange={e => brugGemt(e.target.value)}
                disabled={data.opstillinger.length === 0}>
          <option value="">{data.opstillinger.length === 0 ? "Ingen gemte opstillinger" : "Hent gemt opstilling…"}</option>
          {data.opstillinger.map(o => <option key={o.id} value={String(o.id)}>{o.navn}</option>)}
        </select>
        {plan.opstilling && (
          <button className="knap knap-lille" onClick={() => saetFelt("opstilling", null)}>× Fjern</button>
        )}
      </div>
      <p className="hjaelp">Planen gemmer en kopi – ændrer du tavlen bagefter, er planen uændret.</p>

      <h3>📐 Systemer</h3>
      {data.systemer.length === 0 && <p className="hjaelp">Der er ingen systemer endnu.</p>}
      {slettede.length > 0 && (
        <p className="kp-advarsel">
          {slettede.length === 1 ? "1 valgt system" : `${slettede.length} valgte systemer`} er slettet siden.{" "}
          <button className="kp-link-knap"
                  onClick={() => saetFelt("systemIds", plan.systemIds.filter(id => !slettede.includes(id)))}>
            Ryd op
          </button>
        </p>
      )}
      <div className="kp-system-valg">
        {data.systemer.map(s => {
          const valgt = plan.systemIds.includes(s.id);
          return (
            <label key={s.id} className={"kp-system-valg-punkt" + (valgt ? " valgt" : "")}>
              <input type="checkbox" checked={valgt} onChange={() => skiftSystem(s.id)} />
              <div className="kp-system-valg-bane"><MiniBane system={s} /></div>
              <span>{s.navn || "Unavngivet system"}</span>
            </label>
          );
        })}
      </div>

      <h3>📝 Noter</h3>
      <textarea className="noter" rows={6} placeholder="Taktik, fokuspunkter, hvem starter på bænken…"
                value={plan.noter} onChange={e => saetFelt("noter", e.target.value)} />
    </div>
  );
}
