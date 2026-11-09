/*
  PERSONLIGE MÅL – træneren sætter et mål for en spiller, fx "Skud % ≥ 55",
  og appen regner AUTOMATISK ud, hvor tæt spilleren er på, ud fra hans kampe.

  Målene gemmes i data.personligeMaal: { id, spillerId, type, maal, sidsteN? }
    type    – hvilken slags mål (nøglerne i MAAL_TYPER i beregning.js)
    maal    – tallet man vil nå (fx 55)
    sidsteN – (valgfrit) regn kun på de seneste N kampe. Mangler det: alle kampe.

  Formularen bruges både til at tilføje et nyt mål og til at rette et eksisterende
  (så står id'et på målet i "redigererId").
*/
import { useState } from "react";
import { useData } from "../../DataKontekst.jsx";
import { useDialog } from "../../komponenter/Dialog.jsx";
import { nytId, sorteretTrup } from "../../hjaelpere.js";
import { MAAL_TYPER, maalTekst, typePasserTilSpiller } from "./beregning.js";
import MaalBjaelke from "./MaalBjaelke.jsx";

// Forslag til målet, når man vælger en type (så feltet ikke er tomt)
const FORSLAG = { skudPct: "55", maalPrKamp: "3", assistsPrKamp: "2", fejlPrKamp: "1", redningPct: "35" };

// En tom formular (tallene er tekst, fordi <input> altid giver tekst)
function tomFormular(spillerId) {
  return { spillerId: spillerId ?? "", type: "skudPct", maal: FORSLAG.skudPct, sidsteN: "" };
}

export default function PersonligeMaal() {
  const { data, opdater } = useData();
  const { bekraeftSlet } = useDialog();
  const trup = sorteretTrup(data.spillere);
  const alleMaal = Array.isArray(data.personligeMaal) ? data.personligeMaal : [];

  const [formular, setFormular] = useState(() => tomFormular(trup[0]?.id));
  const [redigererId, setRedigererId] = useState(null);   // null = vi tilføjer et nyt mål
  const [fejl, setFejl] = useState("");

  // Spilleren der er valgt i formularen (er han slettet, tager vi den første)
  const valgtSpiller = trup.find(s => s.id === Number(formular.spillerId)) ?? trup[0] ?? null;
  // Måltyperne der passer til spilleren (Redning % kun for målmænd)
  const typer = Object.keys(MAAL_TYPER).filter(t => typePasserTilSpiller(t, valgtSpiller));
  const valgtType = typer.includes(formular.type) ? formular.type : typer[0];
  const typeInfo = MAAL_TYPER[valgtType];

  function saetFelt(felt, vaerdi) {
    setFormular(gammel => ({ ...gammel, [felt]: vaerdi }));
    setFejl("");
  }

  // Ny type → foreslå et passende tal (men kun når man tilføjer – ikke når man retter)
  function vaelgType(type) {
    setFormular(gammel => ({ ...gammel, type, maal: redigererId == null ? FORSLAG[type] ?? gammel.maal : gammel.maal }));
    setFejl("");
  }

  function annullerRet() {
    setRedigererId(null);
    setFormular(tomFormular(valgtSpiller?.id));
    setFejl("");
  }

  // Kører når man trykker "+ Tilføj mål" / "Gem ændring"
  function gem(e) {
    e.preventDefault();
    if (!valgtSpiller || !typeInfo) return;

    // Tjek tallene, før vi gemmer (komma er ok: "2,5" → 2.5)
    const maal = Number(String(formular.maal).replace(",", "."));
    if (formular.maal === "" || !Number.isFinite(maal) || maal < 0) return setFejl("Skriv et mål på 0 eller mere.");
    if (typeInfo.procent && maal > 100) return setFejl("En procent kan højst være 100.");
    let sidsteN = null;
    if (String(formular.sidsteN).trim() !== "") {
      sidsteN = Number(formular.sidsteN);
      if (!Number.isInteger(sidsteN) || sidsteN < 1) return setFejl("\"Sidste kampe\" skal være et helt tal på 1 eller mere – eller tomt.");
    }

    const nyt = { spillerId: valgtSpiller.id, type: valgtType, maal };
    if (sidsteN) nyt.sidsteN = sidsteN;

    opdater(d => {
      if (!Array.isArray(d.personligeMaal)) d.personligeMaal = [];
      if (redigererId != null) {
        const m = d.personligeMaal.find(x => x.id === redigererId);
        if (m) {
          delete m.sidsteN;                 // fjernes, hvis feltet er tømt (lægges på igen herunder)
          Object.assign(m, nyt);
          return;
        }
      }
      d.personligeMaal.push({ id: nytId(), ...nyt });
    });
    setRedigererId(null);
    setFormular(tomFormular(valgtSpiller.id));   // bliv på samme spiller – man sætter tit flere mål
  }

  // "✎": læg målet op i formularen
  function ret(m) {
    setRedigererId(m.id);
    setFormular({
      spillerId: m.spillerId,
      type: m.type,
      maal: String(m.maal ?? "").replace(".", ","),
      sidsteN: m.sidsteN ? String(m.sidsteN) : "",
    });
    setFejl("");
  }

  async function slet(m, spiller) {
    if (!(await bekraeftSlet("Slet mål?", `"${maalTekst(m)}" for ${spiller?.navn ?? "spilleren"} bliver slettet.`))) return;
    opdater(d => { d.personligeMaal = (d.personligeMaal ?? []).filter(x => x.id !== m.id); });
    if (redigererId === m.id) annullerRet();
  }

  // Målene samlet pr. spiller (i truppens rækkefølge). Mål for slettede spillere kommer til sidst.
  const grupper = trup
    .map(s => ({ spiller: s, maal: alleMaal.filter(m => m.spillerId === s.id && MAAL_TYPER[m.type]) }))
    .filter(g => g.maal.length > 0);
  const foraeldreloese = alleMaal.filter(m => !trup.some(s => s.id === m.spillerId) || !MAAL_TYPER[m.type]);

  return (
    <div>
      {trup.length === 0 ? (
        <p className="tom-tekst">Tilføj spillere først.</p>
      ) : (
        <form className={"skade-form maal-form" + (redigererId != null ? " retter" : "")} onSubmit={gem}>
          <div className="felt-raekke stat-valg">
            <label className="felt">Spiller
              <select value={valgtSpiller?.id ?? ""} onChange={e => saetFelt("spillerId", Number(e.target.value))}>
                {trup.map(s => <option key={s.id} value={s.id}>#{s.nummer} {s.navn} ({s.rolle})</option>)}
              </select>
            </label>
            <label className="felt">Måltype
              <select value={valgtType} onChange={e => vaelgType(e.target.value)}>
                {typer.map(t => (
                  <option key={t} value={t}>{MAAL_TYPER[t].navn} {MAAL_TYPER[t].hoejereErBedre ? "(mindst)" : "(højst)"}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="felt-raekke stat-valg">
            <label className="felt">
              Mål {typeInfo?.hoejereErBedre ? "≥" : "≤"}{typeInfo?.procent ? " (%)" : ""}
              <input type="text" inputMode="decimal" required maxLength={6}
                     value={formular.maal} onChange={e => saetFelt("maal", e.target.value)} />
            </label>
            <label className="felt">Over de sidste … kampe
              <input type="number" min="1" max="99" placeholder="Alle kampe"
                     value={formular.sidsteN} onChange={e => saetFelt("sidsteN", e.target.value)} />
            </label>
          </div>
          <p className="besked fejl">{fejl}</p>
          <div className="maal-form-knapper">
            <button type="submit" className="knap knap-primaer">{redigererId != null ? "💾 Gem ændring" : "+ Tilføj mål"}</button>
            {redigererId != null && <button type="button" className="knap" onClick={annullerRet}>Annuller</button>}
          </div>
        </form>
      )}

      {grupper.length === 0 && foraeldreloese.length === 0 ? (
        <p className="tom-tekst maal-tom">Ingen personlige mål endnu.</p>
      ) : (
        <div className="maal-grupper">
          {grupper.map(({ spiller, maal }) => (
            <div key={spiller.id}>
              <h4 className="maal-spiller">#{spiller.nummer} {spiller.navn}</h4>
              {maal.map((m, i) => (
                <MaalBjaelke key={m.id ?? "x" + i} maal={m} spiller={spiller}>
                  <span className="maal-knapper">
                    <button type="button" className="slet-x" title="Ret mål" onClick={() => ret(m)}>✎</button>
                    <button type="button" className="slet-x" title="Slet mål" onClick={() => slet(m, spiller)}>×</button>
                  </span>
                </MaalBjaelke>
              ))}
            </div>
          ))}
          {/* Mål hvor spilleren er slettet (eller typen er ukendt) – kan kun slettes */}
          {foraeldreloese.length > 0 && (
            <div>
              <h4 className="maal-spiller">Mål uden spiller</h4>
              {foraeldreloese.map((m, i) => (
                <div key={m.id ?? "x" + i} className="maal-kort">
                  <div className="maal-top">
                    <div className="maal-titel">
                      <b>{maalTekst(m)}</b>
                      <small>{MAAL_TYPER[m.type] ? "spilleren findes ikke længere" : "ukendt måltype"}</small>
                    </div>
                    <span className="maal-knapper">
                      <button type="button" className="slet-x" title="Slet mål" onClick={() => slet(m, null)}>×</button>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
