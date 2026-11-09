/*
  SIDE 3: SYSTEMER – angrebs- og forsvarssystemer som animation.

  Siden har to "visninger":
    1) Oversigten med alle gemte systemer som kort (systemer/SystemOversigt.jsx)
    2) Et åbent system, som man kan se, afspille og redigere (systemer/SystemEditor.jsx)

  Filerne i mappen systemer/:
    SystemOversigt.jsx – kortene ("Mine systemer")
    MiniBane.jsx       – den lille tegning på hvert kort
    SystemEditor.jsx   – seer/rediger, panelet, gem/kassér, tastatur, præsentation
    SystemBane.jsx     – banen med brikker, bold, pile og træk med musen/fingeren
    useAfspilning.js   – afspilningen (▶ Start, tidslinje, requestAnimationFrame)
    helBane.js         – systemer på hel bane (kontra/omstilling): startopstilling og skift af bane
    kontraSkabelon.js  – skabelonen "Kontra: hurtigt modløb" (hel bane)
    videoEksport.js    – "🎬 Gem som video": tegner systemet på et <canvas> og optager det
    Systemer.css       – CSS til hel bane og video
*/
import { useCallback, useState } from "react";
import { useData } from "../DataKontekst.jsx";
import { nytSystemData } from "../data/standardData.js";
import SystemOversigt from "./systemer/SystemOversigt.jsx";
import SystemEditor from "./systemer/SystemEditor.jsx";
import { nytHelBaneSystemData } from "./systemer/helBane.js";

export default function Systemer() {
  const { data } = useData();

  /*
    Hvilket system er åbent?
      null                          → vis oversigten
      { id, nytSystem: null }       → et gemt system (åbner som seer)
      { id, nytSystem: {...} }      → et helt nyt system, der endnu ikke er gemt (åbner i redigering)
  */
  const [aabent, setAabent] = useState(null);

  function aabnSystem(id) {
    setAabent({ id, nytSystem: null });
  }

  /*
    type = "angreb" eller "forsvar" (man vælger i oversigten, når man trykker "+ Nyt system").
    helBane = true → et kontraangreb på hel bane med sin egen startopstilling (se helBane.js).
  */
  function nytSystem(type = "angreb", helBane = false) {
    // Det nye system lægges IKKE i data.systemer endnu – det sker først, når man trykker Gem
    const nr = data.systemer.length + 1;
    const s = helBane
      ? nytHelBaneSystemData(`Ny kontra ${nr}`, type)
      : nytSystemData(`${type === "forsvar" ? "Nyt forsvar" : "Nyt system"} ${nr}`, "6-0", type);
    setAabent({ id: s.id, nytSystem: s });
  }

  // useCallback: samme funktion ved hver tegning (editoren bruger den i en useEffect)
  const tilOversigt = useCallback(() => setAabent(null), []);

  return (
    <main className="side side-systemer">
      {aabent === null ? (
        <SystemOversigt onAabn={aabnSystem} onNyt={nytSystem} />
      ) : (
        // key={id}: et andet system = en helt ny editor med frisk state (afspilning, kladde osv.)
        <SystemEditor
          key={aabent.id}
          systemId={aabent.id}
          nytSystem={aabent.nytSystem}
          onLuk={tilOversigt}
        />
      )}
    </main>
  );
}
