/*
  SYSTEM-OVERSIGT – alle gemte systemer som kort (det man ser først på Systemer-siden).

  Props (det komponenten får fra Systemer.jsx):
    onAabn(id)    – åbn et gemt system
    onNyt(type, helBane) – lav et nyt system, type = "angreb" eller "forsvar",
                           helBane = true for et system på hel bane (kontra)
*/
import { useData } from "../../DataKontekst.jsx";
import { useDialog } from "../../komponenter/Dialog.jsx";
import MiniBane from "./MiniBane.jsx";
import { harForgrening, effektivtSystem, antalTrinIalt } from "../../systemVarianter.js";
import { erForsvarssystem } from "../../systemRoller.js";
import { manglendeSkabeloner } from "../../data/skabeloner.js";
import { KONTRA_NAVN, kontraSkabelon } from "./kontraSkabelon.js";
import "./Systemer.css";

/*
  Teksten under kortet, fx "4 trin · 6-0-forsvar" eller "4 trin · 2 varianter · 6-0-forsvar".
  Har systemet varianter, tæller vi de fælles trin + den første variant (det man ser på tegningen).
*/
function metaTekst(s) {
  // I et forsvarssystem er formationen VORES forsvar – ellers modstanderens
  // (Et system på hel bane har normalt ingen formation – modstanderne løber jo hjem)
  const forsvar = !s.forsvar ? (s.helBane ? "hel bane" : "uden forsvar")
    : erForsvarssystem(s) ? "vores " + s.forsvar : s.forsvar + "-forsvar";
  if (!harForgrening(s)) return `${s.trin.length} trin · ${forsvar}`;
  return `${effektivtSystem(s, null).trin.length} trin · ${s.forgrening.varianter.length} varianter · ${forsvar}`;
}

export default function SystemOversigt({ onAabn, onNyt }) {
  const { data, opdater } = useData();
  const { spoerg, bekraeftSlet } = useDialog();
  const systemer = data.systemer;

  /*
    "+ Nyt system": spørg først, hvilken slags system det skal være.
    Angreb og forsvar er på en halv bane. Kontra er et angreb på HEL bane (se helBane.js).
  */
  async function nytKlik() {
    const valg = await spoerg("Nyt system",
      "Skal det være et angrebssystem, et forsvarssystem eller et kontraangreb på hele banen?", [
        { tekst: "Annuller", svar: null },
        { tekst: "⚔️ Angreb", svar: "angreb", stil: "knap-primaer" },
        { tekst: "🛡️ Forsvar", svar: "forsvar", stil: "knap-primaer" },
        { tekst: "🔄 Kontra (hel bane)", svar: "kontra", stil: "knap-primaer" },
      ]);
    if (!valg) return;               // null = Annuller eller Escape
    if (valg === "kontra") onNyt("angreb", true);
    else onNyt(valg, false);
  }

  /*
    "📚 Tilføj skabeloner": læg de skabeloner ind, man ikke allerede har (sammenlignet på navnet).
    De nye id'er skal være unikke – derfor starter vi over det højeste id, der allerede findes.
  */
  async function tilfoejSkabeloner() {
    const startId = Math.max(Date.now(), ...systemer.map(s => Number(s.id) + 1 || 0));
    const nye = manglendeSkabeloner(systemer, startId);
    // Kontra-skabelonen (hel bane) bor i sin egen fil – den kommer med, hvis navnet ikke findes.
    // Id'et lægges et godt stykke over de andre skabeloners id'er, så det ikke kan støde sammen.
    if (!systemer.some(s => s.navn === KONTRA_NAVN)) nye.push(kontraSkabelon(startId + 100));
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
              {/* Små mærker: forsvarssystem, hel bane og/eller skabelon */}
              {(erForsvarssystem(s) || s.helBane || s.skabelon) && (
                <div className="system-maerker">
                  {erForsvarssystem(s) && <span className="system-maerke forsvar">🛡️ Forsvar</span>}
                  {s.helBane && <span className="system-maerke hel-bane">🔄 Hel bane</span>}
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
