/*
  AFSPIL SYSTEMER PÅ TAKTIKTAVLEN ("skuffen" i højre kant)

  Tre dele:
    useTavleAfspilning() – en "custom hook" (vores egen hook) med afspilningens tilstand:
                           hvilket system, hvor langt vi er (tid), kører den, hastighed.
    <AfspilLag>          – brikkerne, pilene og bolden der vises OVEN PÅ banen.
    <Skuffe>             – bjælken i højre kant + skuffen med systemlisten og knapperne.

  Hooken bruges i Taktiktavle, som giver resultatet videre til både AfspilLag og Skuffe
  (de står forskellige steder på siden, men skal dele den samme tilstand).

  Har systemet varianter (se systemVarianter.js), vælger man varianten i skuffen.
  Hooken giver så det "effektive" system videre: fælles trin + den valgte variants trin.
*/
import { useEffect, useRef, useState } from "react";
import { tilstandVed, boldPosition } from "../../animation.js";
import {
  VARIANT_BOGSTAVER, harForgrening, findVariant, effektivtSystem, trinNavn as variantTrinNavn,
} from "../../systemVarianter.js";
import { tilProcent } from "../../hjaelpere.js";
import { HjemmeFigur, SystemFigur } from "../../komponenter/Figur.jsx";
import { TrinPile, PileLag } from "../../komponenter/Pile.jsx";
import { erForsvarssystem, erVores } from "../../systemRoller.js";

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

  // Den valgte variant (null = den første). Bruges kun, hvis systemet har varianter.
  const [valgtVariantId, setValgtVariantId] = useState(null);

  const heltSystem = systemer.find(s => s.id === systemId) || null;   // null = intet afspilles
  const variantId = heltSystem && harForgrening(heltSystem) ? findVariant(heltSystem, valgtVariantId).id : null;
  // Det der afspilles: fælles trin + valgt variant (uden varianter: bare systemet selv)
  const system = heltSystem ? effektivtSystem(heltSystem, variantId) : null;
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
    setValgtVariantId(null);          // et nyt system starter med sin første variant
    setKoerer(false);
    saetTid(0);
  }

  // Vælg en anden variant: afspilningen pauses, og tiden holdes inden for den nye tidslinje
  function vaelgVariant(id) {
    if (!heltSystem) return;
    setValgtVariantId(id);
    setKoerer(false);
    saetTid(Math.min(tidRef.current, effektivtSystem(heltSystem, id).trin.length - 1));
  }

  // Navnet på et trin til skiltet, fx "3" eller "4A"
  function trinNavn(index) {
    return heltSystem ? variantTrinNavn(heltSystem, variantId, index) : String(index + 1);
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

  return {
    system, heltSystem, variantId, trinNavn, vaelgVariant,
    tid: visTid, koerer, sekPrTrin, setSekPrTrin, vaelg, startPause, tilStart, spol, stop,
  };
}

// Standard: trin nr. 0 hedder "1", trin nr. 1 hedder "2" osv.
const almindeligtTrinNavn = (index) => String(index + 1);

/*
  Brikkerne til afspilningen: vores spillere fra tavlen + systemets modstandere.
  Står der ingen spiller på en plads, vises pladsens kode (fx "VB") på trøjen.
  En 7. angriber (ST2, ved 7 mod 6) har ingen plads på tavlen – han vises bare som "ST2".

  Et FORSVARSSYSTEM vises med byttede roller (se systemRoller.js): vores forsvarsspillere i gule
  trøjer med numrene 1-6 (og vores målmand "MV"), modstanderens angribere i mørke trøjer.
  Her sætter vi IKKE navne fra opstillingen på – kun numre.
*/
export function AfspilLag({ system, tid, opstilling, spillere, pladsPositioner, trinNavn = almindeligtTrinNavn }) {
  const findSpiller = id => spillere.find(s => s.id === id);
  const t = tilstandVed(system, tid);
  const paaTrin = Number.isInteger(tid);
  const bold = boldPosition(t);
  const forsvar = erForsvarssystem(system);

  // Pilene: står vi præcis på et trin, vises pilene der førte hertil – ellers dem vi er på vej ad (svagere)
  const pile = paaTrin
    ? { fra: tid > 0 ? system.trin[tid - 1] : null, til: system.trin[tid], synlighed: 1 }
    : { fra: system.trin[t.fraIndex], til: system.trin[t.fraIndex + 1], synlighed: 0.45 };

  const skilt = `${system.navn} · ` +
    (paaTrin ? `Trin ${trinNavn(tid)} af ${system.trin.length}` : `Trin ${trinNavn(t.fraIndex)} → ${trinNavn(t.fraIndex + 1)}`);

  // Vores målmand fra tavlen – kun i angreb (i et forsvarssystem er vores målmand M0 i selve systemet)
  const mv = forsvar ? null : findSpiller(opstilling.MV);

  return (
    <div className="afspil-lag">
      <PileLag synlighed={pile.synlighed}>
        <TrinPile fraTrin={pile.fra} tilTrin={pile.til} forsvar={forsvar} />
      </PileLag>
      <div className="bold vis-bold" style={tilProcent(bold.x, bold.y)} />
      <div className="trin-skilt">{skilt}</div>

      {Object.keys(system.trin[0].pos).map(noegle => {
        const pos = t.pos[noegle];
        if (!pos) return null;
        const stil = tilProcent(pos.x, pos.y);
        // "modst" (lidt mindre brik) = modstanderen: M-nøglerne i angreb, angriberne i forsvar
        const klasse = "sbrik" + (erVores(system, noegle) ? "" : " modst");
        // Spillere fra opstillingen kun på vores angribere i et angrebssystem.
        // ST2 har ingen plads i opstillingen → opstilling.ST2 findes ikke → ingen spiller.
        const spiller = !forsvar && !noegle.startsWith("M") ? findSpiller(opstilling[noegle]) : null;
        return (
          <div key={noegle} className={klasse} style={stil}>
            <SystemFigur noegle={noegle} forsvar={forsvar} tekst={spiller ? spiller.nummer : undefined} />
            {spiller && <span className="sbrik-navn">{spiller.navn}</span>}
          </div>
        );
      })}

      {/* Vores målmand står stille der, hvor han står på tavlen (han er ikke med i angrebssystemerne) */}
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
  const {
    system, heltSystem, variantId, vaelgVariant,
    tid, koerer, sekPrTrin, setSekPrTrin, vaelg, startPause, tilStart, spol, stop,
  } = afspilning;

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
          Tomme pladser vises med positionen på trøjen. Forsvarssystemer (🛡️) vises med numre.</p>

        <div>
          {systemer.length === 0 && (
            <p className="tom-tekst">Du har ingen systemer endnu.<br />Lav dem under fanen Systemer.</p>
          )}
          {/* Systemer på HEL bane (kontra) kan ikke vises på tavlens halve bane – de står der,
              men kan ikke vælges (disabled) og får en lille note */}
          {systemer.map(s => (
            <button
              key={s.id}
              className={"skuffe-system" + (system && s.id === system.id ? " aktiv" : "")}
              disabled={s.helBane === true}
              title={s.helBane ? "Systemer på hel bane kan kun afspilles på Systemer-siden" : undefined}
              style={s.helBane ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
              onClick={() => { if (!s.helBane) vaelg(s.id); }}
            >
              <b>{s.navn}</b>
              {s.helBane && <small>🔄 Hel bane – kun på Systemer-siden</small>}
              <small>
                {erForsvarssystem(s) && "🛡️ Forsvar · "}
                {harForgrening(s)
                  ? `${effektivtSystem(s, null).trin.length} trin · ${s.forgrening.varianter.length} varianter`
                  : `${s.trin.length} trin`}
                {" · "}{s.forsvar ? s.forsvar + "-forsvar" : "uden forsvar"}
              </small>
            </button>
          ))}
        </div>

        {/* Afspilleren – vises kun, når man har valgt et system */}
        {system && (
          <div className="skuffe-afspiller">
            <b>{system.navn}</b>
            {/* 🔀 Systemet har varianter: vælg hvilken der skal afspilles */}
            {harForgrening(heltSystem) && (
              <div className="variant-vaelger">
                <span className="variant-spoergsmaal">🔀 {heltSystem.forgrening.spoergsmaal || "Vælg variant"}</span>
                <select
                  className="lille-valg"
                  title="Hvilken variant skal afspilles?"
                  value={variantId}
                  onChange={e => vaelgVariant(e.target.value)}
                >
                  {heltSystem.forgrening.varianter.map((v, i) => (
                    <option key={v.id} value={v.id}>{VARIANT_BOGSTAVER[i]}: {v.navn || "Uden navn"}</option>
                  ))}
                </select>
              </div>
            )}
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
