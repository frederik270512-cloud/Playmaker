/*
  PLANVISNING – selve kampplanen som ét "ark papir". Det er DETTE, der bliver printet.

    1. Toppen:          titel, dato og modstander
    2. Modstanderen:    styrker, "vær opmærksom på", forsvar og nøglespillere (fra Oversigt)
    3. Startopstilling: en lille bane med vores 7 + listen med udskiftere
    4. Systemer:        de valgte systemer som små tegninger
    5. Noter

  Alt er "forsigtigt": er en modstander, et system eller en spiller blevet slettet,
  efter planen blev lavet, springer vi den bare over (eller viser en lille besked).
*/
import BaneSVG from "../../komponenter/BaneSVG.jsx";
import { HjemmeFigur, ModstanderFigur } from "../../komponenter/Figur.jsx";
import RolleChip from "../../komponenter/RolleChip.jsx";
import MiniBane from "../systemer/MiniBane.jsx";
import { PLADSER, ROLLER } from "../../data/konstanter.js";
import { aktivSkade, formatDato, sorteretTrup, tilProcent } from "../../hjaelpere.js";
import { visTitel } from "./kampplanHjaelpere.js";

export default function PlanVisning({ plan, modstander, spillere, systemer }) {
  return (
    <article className="kp-ark">
      {/* (en <div> og ikke <header> – styles.css giver alle <header> appens top-udseende) */}
      <div className="kp-ark-top">
        <h1>{visTitel(plan, modstander)}</h1>
        <div className="kp-ark-meta">
          <span>📅 {formatDato(plan.dato)}</span>
          <span>🆚 {modstander ? (modstander.navn || "Unavngivet hold") : "Ingen modstander valgt"}</span>
        </div>
      </div>

      <Modstanderen modstander={modstander} />
      <Startopstilling opstilling={plan.opstilling} spillere={spillere} />
      <Systemer systemIds={plan.systemIds} systemer={systemer} />

      <section className="kp-afsnit">
        <h2>📝 Noter</h2>
        {plan.noter.trim()
          ? <p className="kp-tekst">{plan.noter}</p>
          : <p className="kp-tom">Ingen noter.</p>}
      </section>
    </article>
  );
}

/* ---------- 2. Modstanderen ---------- */
function Modstanderen({ modstander }) {
  if (!modstander) {
    return (
      <section className="kp-afsnit">
        <h2>🆚 Modstanderen</h2>
        <p className="kp-tom">Ingen modstander valgt – eller holdet er slettet under Oversigt.</p>
      </section>
    );
  }
  const noegle = [...(modstander.noeglespillere || [])].sort((a, b) => a.nummer - b.nummer);
  return (
    <section className="kp-afsnit">
      <h2>🆚 Modstanderen: {modstander.navn || "Unavngivet hold"}</h2>
      <div className="kp-to-kolonner">
        <div>
          <h3>💪 Det er de gode til</h3>
          {modstander.styrker?.trim() ? <p className="kp-tekst">{modstander.styrker}</p> : <p className="kp-tom">Intet skrevet.</p>}
        </div>
        <div>
          <h3>⚠️ Vær opmærksom på</h3>
          {modstander.opmaerksom?.trim() ? <p className="kp-tekst">{modstander.opmaerksom}</p> : <p className="kp-tom">Intet skrevet.</p>}
        </div>
      </div>
      <p className="kp-linje"><b>🛡️ Forsvar de plejer at spille:</b> {modstander.forsvar ? modstander.forsvar : "Ved ikke"}</p>

      <h3>⭐ Nøglespillere</h3>
      {noegle.length === 0 ? (
        <p className="kp-tom">Ingen nøglespillere tilføjet.</p>
      ) : (
        <div className="kp-noegle-liste">
          {noegle.map(sp => (
            <div className="kp-noegle" key={sp.id}>
              <div className="kp-noegle-figur">
                <ModstanderFigur tekst={sp.nummer} maalmand={sp.position === "MV"} />
              </div>
              <div>
                <b>#{sp.nummer} {sp.navn}</b> {sp.position && <RolleChip kode={sp.position} />}
                {sp.note && <div className="kp-noegle-note">{sp.note}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ---------- 3. Startopstilling ---------- */
function Startopstilling({ opstilling, spillere }) {
  const findSpiller = id => spillere.find(s => s.id === id) || null;

  if (!opstilling) {
    return (
      <section className="kp-afsnit">
        <h2>🤾 Startopstilling</h2>
        <p className="kp-tom">Ingen startopstilling valgt endnu.</p>
      </section>
    );
  }

  // De spillere der står på banen (slettede spillere springes over)
  const paaBanen = new Set(Object.values(opstilling.spillere).filter(id => findSpiller(id)));
  const udskiftere = sorteretTrup(spillere.filter(s => !paaBanen.has(s.id)));

  return (
    <section className="kp-afsnit">
      <h2>🤾 Startopstilling</h2>
      <div className="kp-opstilling">
        {/* Banen: BaneSVG i bunden, og spillerne lagt ovenpå med procent-positioner */}
        <div className="kp-bane">
          <BaneSVG />
          {PLADSER.map(plads => {
            const spiller = findSpiller(opstilling.spillere[plads.rolle]);
            if (!spiller) return null;
            const p = opstilling.pladsPositioner[plads.rolle];
            return (
              <div key={plads.rolle} className="kp-brik" style={tilProcent(p.x, p.y)} title={ROLLER[plads.rolle].navn}>
                <div className="kp-brik-figur">
                  <HjemmeFigur rolle={plads.rolle} tekst={spiller.nummer} />
                </div>
                <span className="kp-brik-navn">
                  {spiller.navn}{aktivSkade(spiller) ? " 🩹" : ""}
                </span>
              </div>
            );
          })}
        </div>

        <div className="kp-hold-lister">
          <h3>På banen</h3>
          <ul className="kp-spiller-liste">
            {PLADSER.map(plads => {
              const spiller = findSpiller(opstilling.spillere[plads.rolle]);
              return (
                <li key={plads.rolle}>
                  <span className="kp-plads">{plads.rolle}</span>
                  {spiller
                    ? <>#{spiller.nummer} {spiller.navn}{aktivSkade(spiller) && <span title="Skadet"> 🩹</span>}</>
                    : <span className="kp-svag">– ingen –</span>}
                </li>
              );
            })}
          </ul>

          <h3>Udskiftere</h3>
          {udskiftere.length === 0 ? (
            <p className="kp-tom">Ingen udskiftere.</p>
          ) : (
            <ul className="kp-spiller-liste">
              {udskiftere.map(s => {
                const skade = aktivSkade(s);
                return (
                  <li key={s.id} className={skade ? "kp-skadet" : ""}>
                    <span className="kp-plads">{s.rolle}</span>
                    #{s.nummer} {s.navn}
                    {skade && <span title={skade.type}> 🩹 {skade.type || "skadet"}</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
      {opstilling.kilde && <p className="kp-kilde">Opstilling fra: {opstilling.kilde}</p>}
    </section>
  );
}

/* ---------- 4. Systemer ---------- */
function Systemer({ systemIds, systemer }) {
  // Vis i samme rækkefølge som på Systemer-siden. Slettede systemer findes ikke længere → kommer ikke med.
  const valgte = systemer.filter(s => systemIds.includes(s.id));
  return (
    <section className="kp-afsnit">
      <h2>📐 Systemer</h2>
      {valgte.length === 0 ? (
        <p className="kp-tom">Ingen systemer valgt.</p>
      ) : (
        <div className="kp-systemer">
          {valgte.map(s => (
            <div className="kp-system" key={s.id}>
              <div className="kp-system-bane"><MiniBane system={s} /></div>
              <div className="kp-system-tekst">
                <b>{s.navn || "Unavngivet system"}</b>
                <span className="kp-system-type">{s.type === "forsvar" ? "🛡️ Forsvar" : "⚔️ Angreb"}</span>
                {s.beskrivelse && <p>{s.beskrivelse}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
