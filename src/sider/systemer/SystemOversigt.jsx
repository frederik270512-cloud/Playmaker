/*
  SYSTEM-OVERSIGT – alle gemte systemer som kort (det man ser først på Systemer-siden).

  Props (det komponenten får fra Systemer.jsx):
    onAabn(id)    – åbn et gemt system
    onNyt(type)   – lav et nyt system, type = "angreb" eller "forsvar"
*/
import { useData } from "../../DataKontekst.jsx";
import { useDialog } from "../../komponenter/Dialog.jsx";
import MiniBane from "./MiniBane.jsx";
import { harForgrening, effektivtSystem, antalTrinIalt } from "../../systemVarianter.js";
import { erForsvarssystem } from "../../systemRoller.js";
import { manglendeSkabeloner } from "../../data/skabeloner.js";

/*
  Teksten under kortet, fx "4 trin · 6-0-forsvar" eller "4 trin · 2 varianter · 6-0-forsvar".
  Har systemet varianter, tæller vi de fælles trin + den første variant (det man ser på tegningen).
*/
function metaTekst(s) {
  // I et forsvarssystem er formationen VORES forsvar – ellers modstanderens
  const forsvar = !s.forsvar ? "uden forsvar" : erForsvarssystem(s) ? "vores " + s.forsvar : s.forsvar + "-forsvar";
  if (!harForgrening(s)) return `${s.trin.length} trin · ${forsvar}`;
  return `${effektivtSystem(s, null).trin.length} trin · ${s.forgrening.varianter.length} varianter · ${forsvar}`;
}

export default function SystemOversigt({ onAabn, onNyt }) {
  const { data, opdater } = useData();
  const { spoerg, bekraeftSlet } = useDialog();
  const systemer = data.systemer;

  // "+ Nyt system": spørg først, om det skal være et angrebs- eller forsvarssystem
  async function nytKlik() {
    const type = await spoerg("Nyt system", "Skal det være et angrebssystem eller et forsvarssystem?", [
      { tekst: "Annuller", svar: null },
      { tekst: "⚔️ Angreb", svar: "angreb", stil: "knap-primaer" },
      { tekst: "🛡️ Forsvar", svar: "forsvar", stil: "knap-primaer" },
    ]);
    if (type) onNyt(type);           // null = Annuller eller Escape
  }

  /*
    "📚 Tilføj skabeloner": læg de skabeloner ind, man ikke allerede har (sammenlignet på navnet).
    De nye id'er skal være unikke – derfor starter vi over det højeste id, der allerede findes.
  */
  async function tilfoejSkabeloner() {
    const startId = Math.max(Date.now(), ...systemer.map(s => Number(s.id) + 1 || 0));
    const nye = manglendeSkabeloner(systemer, startId);
    if (nye.length === 0) {
      await spoerg("Skabeloner", "Alle skabeloner er allerede tilføjet.", [
        { tekst: "OK", svar: true, stil: "knap-primaer" },
      ]);
      return;
    }
    const svar = await spoerg(
      nye.length === 1 ? "Tilføj 1 skabelon?" : `Tilføj ${nye.length} skabeloner?`,
      `Disse systemer bliver lagt ind, så du kan se og rette i dem: ${nye.map(s => s.navn).join(", ")}.`,
      [
        { tekst: "Annuller", svar: false },
        { tekst: "📚 Tilføj", svar: true, stil: "knap-primaer" },
      ],
    );
    if (svar !== true) return;
    opdater(d => { d.systemer.push(...nye); });
  }

  async function sletSystem(e, system) {
    // stopPropagation: klikket må ikke OGSÅ nå ud til kortet (så ville systemet åbne)
    e.stopPropagation();
    if (!(await bekraeftSlet(`Slet "${system.navn}"?`,
        `Systemet og alle dets ${antalTrinIalt(system)} trin bliver slettet. Det kan ikke fortrydes.`))) return;
    opdater(d => { d.systemer = d.systemer.filter(s => s.id !== system.id); });
  }

  return (
    <div className="system-oversigt">
      <div className="liste-top">
        <div>
          <h2>Mine systemer</h2>
          <p className="opsummering">
            {systemer.length === 1 ? "1 gemt system" : `${systemer.length} gemte systemer`}
          </p>
        </div>
        <div className="knap-raekke oversigt-knapper">
          <button className="knap" title="Læg de klassiske skabeloner ind blandt dine systemer" onClick={tilfoejSkabeloner}>
            📚 Tilføj skabeloner
          </button>
          <button className="knap knap-primaer" onClick={nytKlik}>+ Nyt system</button>
        </div>
      </div>

      <div className="system-gitter">
        {/* key={s.id}: React bruger nøglen til at holde styr på, hvilket kort der er hvilket */}
        {systemer.map(s => (
          <div key={s.id} className="system-kort" onClick={() => onAabn(s.id)}>
            <MiniBane system={s} />
            <div className="system-kort-tekst">
              <h3>{s.navn}</h3>
              {/* Små mærker: forsvarssystem og/eller skabelon */}
              {(erForsvarssystem(s) || s.skabelon) && (
                <div className="system-maerker">
                  {erForsvarssystem(s) && <span className="system-maerke forsvar">🛡️ Forsvar</span>}
                  {s.skabelon && <span className="system-maerke">📚 Skabelon</span>}
                </div>
              )}
              <p>{s.beskrivelse || "Ingen beskrivelse"}</p>
              <div className="meta">
                {metaTekst(s)}
              </div>
            </div>
            <button className="kort-slet" title="Slet system" onClick={(e) => sletSystem(e, s)}>🗑</button>
          </div>
        ))}

        {/* Et ekstra kort til sidst: "+ Nyt system" */}
        <div className="system-kort nyt-kort" onClick={nytKlik}>
          <span>+</span>Nyt system
        </div>
      </div>
    </div>
  );
}
