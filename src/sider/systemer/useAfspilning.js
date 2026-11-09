/*
  useAfspilning – en "custom hook" (vores egen hook), der styrer afspilningen af et system.

  En hook er bare en funktion, der starter med "use" og selv bruger React-hooks
  (useState, useRef, useEffect). Så kan logikken genbruges og holdes ude af selve tegningen.

  "tid" er HVOR i animationen vi er, målt i trin:
    tid = 0   → præcis på trin 1
    tid = 1.5 → halvvejs mellem trin 2 og trin 3
  Man kan kun redigere, når tid er et helt tal (man står præcis på et trin).

  Brug:
    const afspil = useAfspilning(system.trin.length);
    afspil.tid, afspil.koerer, afspil.startEllerPause(), afspil.gaaTilTrin(2) ...
*/
import { useCallback, useEffect, useRef, useState } from "react";

export default function useAfspilning(antalTrin) {
  // useState: værdier der skal vises på skærmen. Når de ændres, tegner React forfra.
  const [tid, setTid] = useState(0);
  const [koerer, setKoerer] = useState(false);
  const [sekPrTrin, setSekPrTrin] = useState(1.5);    // sekunder pr. trin (hastigheden)

  /*
    useRef: en "kasse" der husker en værdi mellem tegningerne, UDEN at React tegner forfra.
    Animationen (requestAnimationFrame) skal altid kunne læse den NYESTE tid og hastighed,
    også selvom funktionen blev lavet for et øjeblik siden – derfor gemmer vi dem også her.
  */
  const tidRef = useRef(0);
  const sekPrTrinRef = useRef(1.5);

  // Sæt tiden både i ref'en (til animationen) og i state (til skærmen)
  const saetTid = useCallback((nyTid) => {
    tidRef.current = nyTid;
    setTid(nyTid);
  }, []);

  function saetHastighed(sek) {
    sekPrTrinRef.current = sek;
    setSekPrTrin(sek);
  }

  /*
    Selve animationen. useEffect kører, når "koerer" bliver true.
    requestAnimationFrame beder browseren kalde animer() før næste billede (ca. 60 gange i sekundet).
    Funktionen vi returnerer ("oprydning") kører, når koerer bliver false igen, eller når
    siden lukkes – så stopper vi animationen med cancelAnimationFrame.
  */
  useEffect(() => {
    if (!koerer) return;
    let sidsteTidspunkt = null;
    let anmodning = 0;

    function animer(nu) {
      // Første billede: start "uret" her. (Browserens tidsstempel kan ligge en smule
      // FØR det øjeblik man trykkede Start – så ville tiden blive negativ.)
      if (sidsteTidspunkt === null) sidsteTidspunkt = nu;
      const sekunder = (nu - sidsteTidspunkt) / 1000;
      sidsteTidspunkt = nu;

      const slut = antalTrin - 1;
      const nyTid = tidRef.current + sekunder / sekPrTrinRef.current;
      if (nyTid >= slut) {          // færdig → stop præcis på sidste trin
        saetTid(slut);
        setKoerer(false);
        return;
      }
      saetTid(nyTid);
      anmodning = requestAnimationFrame(animer);   // bed om næste billede
    }

    anmodning = requestAnimationFrame(animer);
    return () => cancelAnimationFrame(anmodning);
  }, [koerer, antalTrin, saetTid]);

  // ▶ Start / ⏸ Pause
  function startEllerPause() {
    if (antalTrin < 2) return;
    if (koerer) {
      setKoerer(false);
      return;
    }
    // Står vi på sidste trin, starter vi forfra
    if (tidRef.current >= antalTrin - 1) saetTid(0);
    setKoerer(true);
  }

  function stop() {
    setKoerer(false);
  }

  // Hop direkte til et trin (0 = trin 1)
  function gaaTilTrin(index) {
    setKoerer(false);
    saetTid(index);
  }

  // Næste/forrige HELE trin (bruges af piletasterne)
  function naesteTrin() {
    gaaTilTrin(Math.min(antalTrin - 1, Math.floor(tidRef.current) + 1));
  }
  function forrigeTrin() {
    gaaTilTrin(Math.max(0, Math.ceil(tidRef.current) - 1));
  }

  // Spol til en vilkårlig tid (tidslinjen) – stopper afspilningen
  function spol(nyTid) {
    setKoerer(false);
    saetTid(nyTid);
  }

  // Hvilket trin står vi på? (null hvis vi er mellem to trin)
  const trinIndex = Number.isInteger(tid) ? tid : null;

  return {
    tid, tidRef, koerer, trinIndex, sekPrTrin,
    saetHastighed, startEllerPause, stop, gaaTilTrin, naesteTrin, forrigeTrin, spol,
  };
}
