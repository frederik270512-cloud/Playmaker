/*
  SPILLER-EDITOR – højre panel på Spillere-siden, når en spiller er åben
  (eller man er ved at oprette en ny).

  Props:
    spiller      – spilleren der er åben, eller null når man opretter en ny
    fane         – "historik" eller "info" (den fane man sidst valgte – huskes af forælderen)
    onFane       – funktion der skifter fane
    onOprettet   – kaldes med den nye spillers id, når en NY spiller er gemt
    onSlettet    – kaldes når spilleren er slettet
    startBesked  – besked der vises fra start (bruges til "Gemt ✓" lige efter oprettelse)

  Forælderen giver komponenten en ny "key", hver gang man åbner en spiller. Så starter
  den forfra, og alle felter fyldes med den nye spillers oplysninger.
*/
import { useEffect, useRef, useState } from "react";
import { useData } from "../../DataKontekst.jsx";
import { useDialog } from "../../komponenter/Dialog.jsx";
import { ROLLER } from "../../data/konstanter.js";
import { sikrSpiller } from "../../data/lagring.js";
import NummerHjul from "./NummerHjul.jsx";
import Skader from "./Skader.jsx";
import Historik from "./Historik.jsx";

// Foreslår det laveste trøjenummer der ikke er taget
function ledigtNummer(spillere) {
  let nummer = 1;
  while (spillere.some(s => s.nummer === nummer)) nummer++;
  return nummer;
}

export default function SpillerEditor({ spiller, fane, onFane, onOprettet, onSlettet, startBesked = "" }) {
  const { data, opdater } = useData();
  const { bekraeftSlet } = useDialog();
  const navnRef = useRef(null);

  /*
    Formularens felter. useState(() => ...) med en funktion betyder: regn startværdien ud
    ÉN gang, da komponenten blev lavet. Derefter er det felterne, der bestemmer.
  */
  const [nummerTekst, setNummerTekst] = useState(() => String(spiller ? spiller.nummer : ledigtNummer(data.spillere)));
  const [navn, setNavn] = useState(spiller ? spiller.navn : "");
  const [rolle, setRolle] = useState(spiller ? spiller.rolle : "C");
  const [sekundaer, setSekundaer] = useState(spiller ? spiller.sekundaer : "");
  // Beskeden under formularen: { tekst, type } hvor type er "ok" (grøn) eller "fejl" (rød)
  const [besked, setBesked] = useState({ tekst: startBesked, type: "ok" });

  const erNy = !spiller;
  const spillerId = spiller ? spiller.id : null;
  // De ANDRE spillere – deres numre er optaget (ens eget nummer må man gerne beholde)
  const andre = data.spillere.filter(s => s.id !== spillerId);
  // En ny spiller har ingen historik endnu, så han ser kun Oplysninger
  const visFane = erNy ? "info" : fane;

  // Ny spiller: sæt markøren i navnefeltet (preventScroll: siden må ikke hoppe)
  useEffect(() => {
    if (erNy && navnRef.current) navnRef.current.focus({ preventScroll: true });
  }, [erNy]);

  function visBesked(tekst, type = "ok") {
    setBesked({ tekst, type });
  }

  // Skift primær position. Den sekundære må ikke være den samme – så nulstilles den.
  function skiftRolle(nyRolle) {
    setRolle(nyRolle);
    if (sekundaer === nyRolle) setSekundaer("");
  }

  // Kører når man trykker "Gem spiller"
  function gemSpiller(e) {
    e.preventDefault();   // stop browseren i at genindlæse siden (det gør en form ellers)

    const rentNavn = navn.trim();          // trim() fjerner mellemrum i enderne
    const nummer = Number(nummerTekst);
    const rentSekundaer = sekundaer === rolle ? "" : sekundaer;

    // --- Tjek at data er i orden ---
    if (rentNavn === "") return visBesked("Skriv et navn.", "fejl");
    if (!Number.isInteger(nummer) || nummer < 1 || nummer > 99) {
      return visBesked("Nummeret skal være mellem 1 og 99.", "fejl");
    }
    const optagetAf = andre.find(s => s.nummer === nummer);
    if (optagetAf) return visBesked(`Nummer ${nummer} bruges allerede af ${optagetAf.navn}.`, "fejl");

    if (spiller) {
      // Opdater en eksisterende spiller
      opdater(d => {
        const s = d.spillere.find(x => x.id === spiller.id);
        if (!s) return;
        s.navn = rentNavn;
        s.nummer = nummer;
        s.rolle = rolle;
        s.sekundaer = rentSekundaer;
      });
      setNavn(rentNavn);
      visBesked("Gemt ✓");
    } else {
      // Opret en ny spiller. Nyt id = højeste id + 1.
      // sikrSpiller tilføjer tomme lister for skader, kampe osv.
      const nytId = Math.max(0, ...data.spillere.map(s => s.id)) + 1;
      const ny = sikrSpiller({ id: nytId, nummer, navn: rentNavn, rolle, sekundaer: rentSekundaer });
      opdater(d => { d.spillere.push(ny); });
      onOprettet(nytId);    // forælderen åbner den nye spiller (og viser "Gemt ✓")
    }
  }

  // Kører når man trykker "Slet spiller"
  async function sletSpiller() {
    if (!spiller) return;
    // Vent på svar fra "Er du sikker?"-boksen. Trykker man Annuller, stopper vi her.
    if (!(await bekraeftSlet(`Slet ${spiller.navn}?`,
        "Spilleren og hele hans historik (kampe og skader) bliver slettet. Det kan ikke fortrydes."))) return;

    opdater(d => {
      d.spillere = d.spillere.filter(s => s.id !== spiller.id);     // behold alle ANDRE spillere
      for (const plads in d.opstilling) {                            // fjern også fra banen
        if (d.opstilling[plads] === spiller.id) d.opstilling[plads] = null;
      }
    });
    onSlettet();
  }

  return (
    <div>
      <h2>{spiller ? `#${spiller.nummer} ${spiller.navn}` : "Ny spiller"}</h2>

      {/* Faner: vises kun for spillere der er gemt */}
      {!erNy && (
        <div className="under-faner">
          <button type="button" className={"under-fane" + (visFane === "historik" ? " aktiv" : "")}
                  onClick={() => onFane("historik")}>📊 Historik</button>
          <button type="button" className={"under-fane" + (visFane === "info" ? " aktiv" : "")}
                  onClick={() => onFane("info")}>✏️ Oplysninger</button>
        </div>
      )}

      {/* ================= FANE: OPLYSNINGER =================
          Den tegnes kun, når fanen er valgt. Felternes værdier bor i denne komponent
          (ikke inde i fanen), så de bliver ikke glemt, når man skifter fane. */}
      {visFane === "info" && (
        <div>
          {/* Et <form> giver gratis validering: "required" betyder, at feltet skal udfyldes */}
          <form onSubmit={gemSpiller}>
            <div className="felt-raekke">
              <NummerHjul
                vaerdi={nummerTekst}
                onVaerdi={setNummerTekst}
                andre={andre}
                onBesked={visBesked}
              />
              <div className="felt-kolonne">
                <label className="felt">Navn
                  <input ref={navnRef} type="text" maxLength={30} required
                         value={navn} onChange={e => setNavn(e.target.value)} />
                </label>
                <label className="felt">Position
                  <select required value={rolle} onChange={e => skiftRolle(e.target.value)}>
                    {Object.keys(ROLLER).map(kode => (
                      <option key={kode} value={kode}>{kode} – {ROLLER[kode].navn}</option>
                    ))}
                  </select>
                </label>
                <label className="felt">Sekundær position
                  <select value={sekundaer} onChange={e => setSekundaer(e.target.value)}>
                    <option value="">Ingen</option>
                    {/* Den sekundære position må ikke være den samme som den primære */}
                    {Object.keys(ROLLER).map(kode => (
                      <option key={kode} value={kode} disabled={kode === rolle}>{kode} – {ROLLER[kode].navn}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <p className={"besked " + besked.type}>{besked.tekst}</p>

            <div className="knap-raekke">
              <button type="submit" className="knap knap-primaer">Gem spiller</button>
              {!erNy && <button type="button" className="knap knap-fare" onClick={sletSpiller}>Slet spiller</button>}
            </div>
          </form>

          <h3>Skadehistorik</h3>
          {erNy
            ? <p className="tom-tekst">Gem spilleren først – så kan du tilføje skader.</p>
            : <Skader spiller={spiller} />}
        </div>
      )}

      {/* ================= FANE: HISTORIK ================= */}
      {visFane === "historik" && spiller && <Historik spiller={spiller} />}
    </div>
  );
}
