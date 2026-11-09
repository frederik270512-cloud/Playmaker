/*
  HOLDETS RESULTATER – alle holdets kampe med stilling og V/U/T, nyeste øverst.

  Kampe afsluttet på Kampdag ligger i data.kampResultater (der kender vi stillingen).
  Ældre kampe findes kun i spillernes egen historik – dem samler vi pr. dato +
  modstander og viser "vores mål: X" og "resultat ukendt" (se holdKampe() i beregning.js).
*/
import { useData } from "../../DataKontekst.jsx";
import { formatDato } from "../../hjaelpere.js";
import { holdKampe, udfald } from "./beregning.js";

const UDFALD_TEKST = { V: "Vundet", U: "Uafgjort", T: "Tabt" };

// Et af tallene i opsummeringen øverst
function Tal({ navn, tal, klasse = "" }) {
  return (
    <div className={"stat " + klasse}>
      <div className="stat-tal">{tal}</div>
      <div className="stat-navn">{navn}</div>
    </div>
  );
}

export default function Resultater() {
  const { data } = useData();
  const kampe = holdKampe(data);

  // Opsummeringen tæller kun kampe, hvor vi kender resultatet
  const kendte = kampe.filter(k => k.kendt);
  const antal = { V: 0, U: 0, T: 0 };
  for (const k of kendte) antal[udfald(k)]++;
  const maalFor = kendte.reduce((sum, k) => sum + k.hjemme, 0);
  const maalImod = kendte.reduce((sum, k) => sum + k.ude, 0);
  const ukendte = kampe.length - kendte.length;

  if (kampe.length === 0) {
    return <p className="tom-tekst">Ingen kampe endnu. Når en kamp afsluttes på ⏱️ Kampdag, kommer resultatet her.</p>;
  }

  return (
    <div>
      <div className="stat-gitter resultat-gitter">
        <Tal navn="Kampe" tal={kendte.length} />
        <Tal navn="Vundet" tal={antal.V} klasse="god" />
        <Tal navn="Uafgjort" tal={antal.U} />
        <Tal navn="Tabt" tal={antal.T} klasse="daarlig" />
        <Tal navn="Mål for" tal={maalFor} />
        <Tal navn="Mål imod" tal={maalImod} />
      </div>
      {ukendte > 0 && (
        <p className="opsummering">
          + {ukendte} {ukendte === 1 ? "kamp" : "kampe"} fra spillernes historik uden kendt resultat (tæller ikke med ovenfor).
        </p>
      )}

      <div className="resultat-liste">
        {kampe.map(k => {
          const u = k.kendt ? udfald(k) : null;
          const forskel = k.kendt ? k.hjemme - k.ude : 0;
          return (
            <div key={k.noegle} className={"resultat" + (k.kendt ? "" : " ukendt")}>
              {u
                ? <span className={"udfald-maerke udfald-" + u} title={UDFALD_TEKST[u]}>{u}</span>
                : <span className="udfald-maerke udfald-ukendt" title="Resultat ukendt">?</span>}
              <div className="resultat-info">
                <b>{k.modstander || "Ukendt modstander"}</b>
                <small>{formatDato(k.dato)}</small>
              </div>
              {k.kendt ? (
                <div className="resultat-score">
                  <b>{k.hjemme}–{k.ude}</b>
                  <small className={forskel > 0 ? "plus" : forskel < 0 ? "minus" : ""}>
                    {forskel > 0 ? "+" : ""}{forskel}
                  </small>
                </div>
              ) : (
                <div className="resultat-score">
                  <span>vores mål: <b>{k.voresMaal}</b></span>
                  <small>resultat ukendt</small>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
