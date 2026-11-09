/*
  AFSPIL SYSTEMER PÅ TAKTIKTAVLEN ("skuffen" i højre kant)

  Tre dele:
    useTavleAfspilning() – en "custom hook" (vores egen hook) med afspilningens tilstand:
                           hvilket system, hvor langt vi er (tid), kører den, hastighed.
    <AfspilLag>          – brikkerne, pilene og bolden der vises OVEN PÅ banen.
    <Skuffe>             – bjælken i højre kant + skuffen med systemlisten og knapperne.

  Hooken bruges i Taktiktavle, som giver resultatet videre til både AfspilLag og Skuffe
  (de står forskellige steder på siden, men skal dele den samme tilstand).
*/
import { useEffect, useRef, useState } from "react";
import { tilstandVed, boldPosition } from "../../animation.js";
import { tilProcent } from "../../hjaelpere.js";
import { HjemmeFigur, ModstanderFigur } from "../../komponenter/Figur.jsx";
import { TrinPile, PileLag } from "../../komponenter/Pile.jsx";

export function useTavleAfspilning(systemer) {
  const [systemId, setSystemId] = useState(null);
  const [tid, setTid] = useState(0);              // hvor i animationen vi er, målt i trin
  const [koerer, setKoerer] = useState(false);
  const [sekPrTrin, setSekPrTrin] = useState(1.5);

  // tidRef har altid den nyeste tid – animationsløkken læser den uden at vente på React
  const tidRef = useRef(0);
  function saetTid(ny) {
    tidRef.current = ny;
    setTid(ny);
  }

  const system = systemer.find(s => s.id === systemId) || null;   // null = intet afspilles
  const sidsteTrin = system ? system.trin.length - 1 : 0;
  // Har systemet fået færre trin, siden det blev valgt, holder vi tiden inden for systemet
  const visTid = Math.min(tid, sidsteTrin);

  /*
    ANIMATIONEN: requestAnimationFrame kalder vores funktion før hver skærmopdatering (ca. 60 gange
    i sekundet). Vi lægger den tid, der er gået siden sidst, til "tid".
    useEffect starter løkken, når koerer bliver true, og "oprydningen" (return-funktionen)
    stopper den igen – også hvis man forlader siden midt i en afspilning.
  */
  useEffect(() => {
    if (!koerer || systemId === null) return;
    let ramme = null;
    let sidsteTidspunkt = null;                     // sættes ved første billede (ellers negativ tid)

    function naesteBillede(nu) {
      if (sidsteTidspunkt === null) sidsteTidspunkt = nu;
      let ny = tidRef.current + (nu - sidsteTidspunkt) / 1000 / sekPrTrin;
      sidsteTidspunkt = nu;
      if (ny >= sidsteTrin) {
        ny = sidsteTrin;                            // slut – stop på sidste trin
        setKoerer(false);
      } else {
        ramme = requestAnimationFrame(naesteBillede);
      }
      tidRef.current = ny;
      setTid(ny);
    }

    ramme = requestAnimationFrame(naesteBillede);
    return () => cancelAnimationFrame(ramme);
  }, [koerer, systemId, sekPrTrin, sidsteTrin]);

  function vaelg(id) {
    setSystemId(id);
    setKoerer(false);
    saetTid(0);
  }

  // Start / pause – man kan pause på ALLE tidspunkter, også midt mellem to trin
  function startPause() {
    if (!system || system.trin.length < 2) return;
    if (koerer) {
      setKoerer(false);
      return;
    }
    if (visTid >= sidsteTrin) saetTid(0);           // står vi på sidste trin, starter vi forfra
    else saetTid(visTid);
    setKoerer(true);
  }

  function tilStart() {
    setKoerer(false);
    saetTid(0);
  }

  // Tidslinjen: spol hvorhen man vil – den bliver stående der (ingen "hop" til nærmeste trin)
  function spol(ny) {
    setKoerer(false);
    saetTid(ny);
  }

  function stop() {
    setKoerer(false);
    setSystemId(null);
  }

  return { system, tid: visTid, koerer, sekPrTrin, setSekPrTrin, vaelg, startPause, tilStart, spol, stop };
}

/*
  Brikkerne til afspilningen: vores spillere fra tavlen + systemets modstandere.
  Står der ingen spiller på en plads, vises pladsens kode (fx "VB") på trøjen.
*/
export function AfspilLag({ system, tid, opstilling, spillere, pladsPositioner }) {
  const findSpiller = id => spillere.find(s => s.id === id);
  const t = tilstandVed(system, tid);
  const paaTrin = Number.isInteger(tid);
  const bold = boldPosition(t);

  // Pilene: står vi præcis på et trin, vises pilene der førte hertil – ellers dem vi er på vej ad (svagere)
  const pile = paaTrin
    ? { fra: tid > 0 ? system.trin[tid - 1] : null, til: system.trin[tid], synlighed: 1 }
    : { fra: system.trin[t.fraIndex], til: system.trin[t.fraIndex + 1], synlighed: 0.45 };

  const skilt = `${system.navn} · ` +
    (paaTrin ? `Trin ${tid + 1} af ${system.trin.length}` : `Trin ${t.fraIndex + 1} → ${t.fraIndex + 2}`);

  const mv = findSpiller(opstilling.MV);

  return (
    <div className="afspil-lag">
      <PileLag synlighed={pile.synlighed}>
        <TrinPile fraTrin={pile.fra} tilTrin={pile.til} />
      </PileLag>
      <div className="bold vis-bold" style={tilProcent(bold.x, bold.y)} />
      <div className="trin-skilt">{skilt}</div>

      {Object.keys(system.trin[0].pos).map(noegle => {
        const pos = t.pos[noegle];
        if (!pos) return null;
        const stil = tilProcent(pos.x, pos.y);
        // Nøgler der starter med "M" er modstandere (M0 = målmand, M1-M6 = forsvarsspillere)
        if (noegle.startsWith("M")) {
          return (
            <div key={noegle} className="sbrik modst" style={stil}>
              <ModstanderFigur nr={Number(noegle.slice(1))} />
            </div>
          );
        }
        const spiller = findSpiller(opstilling[noegle]);
        return (
          <div key={noegle} className="sbrik" style={stil}>
            <HjemmeFigur rolle={noegle} tekst={spiller ? spiller.nummer : noegle} />
            {spiller && <span className="sbrik-navn">{spiller.navn}</span>}
          </div>
        );
      })}

      {/* Vores målmand står stille der, hvor han står på tavlen (han er ikke med i systemerne) */}
      {mv && (
        <div className="sbrik" style={tilProcent(pladsPositioner.MV.x, pladsPositioner.MV.y)}>
          <HjemmeFigur rolle="MV" tekst={mv.nummer} />
          <span className="sbrik-navn">{mv.navn}</span>
        </div>
      )}
    </div>
  );
}

// Bjælken "◀ Systemer" og selve skuffen
export default function Skuffe({ systemer, afspilning }) {
  const [aaben, setAaben] = useState(false);
  const { system, tid, koerer, sekPrTrin, setSekPrTrin, vaelg, startPause, tilStart, spol, stop } = afspilning;

  return (
    <>
      <button className={"skuffe-tap" + (aaben ? " aaben" : "")} onClick={() => setAaben(!aaben)}>
        {aaben ? "Luk ▶" : "◀ Systemer"}
      </button>

      <aside className={"skuffe" + (aaben ? " aaben" : "")}>
        <div className="skuffe-top">
          <h2>▶ Afspil system</h2>
          <button className="slet-x" title="Luk" onClick={() => setAaben(false)}>×</button>
        </div>
        <p className="hjaelp">Systemet spilles med de spillere, du har sat på banen.
          Tomme pladser vises med positionen på trøjen.</p>

        <div>
          {systemer.length === 0 && (
            <p className="tom-tekst">Du har ingen systemer endnu.<br />Lav dem under fanen Systemer.</p>
          )}
          {systemer.map(s => (
            <button
              key={s.id}
              className={"skuffe-system" + (system && s.id === system.id ? " aktiv" : "")}
              onClick={() => vaelg(s.id)}
            >
              <b>{s.navn}</b>
              <small>{s.trin.length} trin · {s.forsvar ? s.forsvar + "-forsvar" : "uden forsvar"}</small>
            </button>
          ))}
        </div>

        {/* Afspilleren – vises kun, når man har valgt et system */}
        {system && (
          <div className="skuffe-afspiller">
            <b>{system.navn}</b>
            <div className="afspiller">
              <button className="knap" title="Tilbage til start" onClick={tilStart}>⏮</button>
              <button className="knap knap-primaer afspil-knap" onClick={startPause} disabled={system.trin.length < 2}>
                {koerer ? "⏸ Pause" : "▶ Start"}
              </button>
              <select
                className="lille-valg"
                title="Hastighed"
                value={String(sekPrTrin)}
                onChange={e => setSekPrTrin(Number(e.target.value))}
              >
                <option value="2.5">Langsom</option>
                <option value="1.5">Normal</option>
                <option value="0.8">Hurtig</option>
              </select>
              {/* Træk i tidslinjen for at spole – den kan stå på ALLE tidspunkter */}
              <input
                type="range"
                min="0"
                max={system.trin.length - 1}
                step="0.01"
                value={tid}
                onChange={e => spol(Number(e.target.value))}
              />
            </div>
            <button className="knap knap-fare" onClick={stop}>✕ Stop – vis tavlen igen</button>
          </div>
        )}
      </aside>
    </>
  );
}
