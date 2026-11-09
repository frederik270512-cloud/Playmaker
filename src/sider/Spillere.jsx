/*
  SIDE: SPILLERE
    Venstre: tabellen med hele truppen ("Truppen").
    Højre:   redigering af den valgte spiller (SpillerEditor) – eller en tekst, hvis ingen er valgt.

  Delene til højre ligger i mappen ./spillere/:
    SpillerEditor.jsx – titel, faner og formularen "Oplysninger"
    NummerHjul.jsx    – hjulet til trøjenummeret
    Skader.jsx        – skadehistorikken
    Historik.jsx      – kampe, statistik, "Bedst imod" og evaluering
*/
import { useRef, useState } from "react";
import { useData } from "../DataKontekst.jsx";
import { ROLLER } from "../data/konstanter.js";
import { sorteretTrup, aktivSkade, sumAf } from "../hjaelpere.js";
import RolleChip from "../komponenter/RolleChip.jsx";
import SpillerEditor from "./spillere/SpillerEditor.jsx";

// På iPad/telefon ligger panelerne under hinanden – så ruller vi ned til det, man lige har åbnet
function rulTilPaaSmalSkaerm(element) {
  if (window.innerWidth <= 1000 && element) element.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function Spillere() {
  const { data } = useData();

  // Tilstand (state) for siden. Når en af dem ændres, tegner React siden forfra.
  const [valgtId, setValgtId] = useState(null);         // id på den åbne spiller (null = ingen)
  const [opretterNy, setOpretterNy] = useState(false);  // true mens man opretter en ny spiller
  const [fane, setFane] = useState("historik");         // klikker man på en spiller, ser man først historikken
  const [startBesked, setStartBesked] = useState("");   // "Gemt ✓" lige efter en ny spiller er oprettet
  // Tælles op hver gang man åbner en spiller. Den bruges i editorens "key", så editoren
  // starter helt forfra (tomme/friske felter) – også hvis man klikker på den samme spiller igen.
  const [udgave, setUdgave] = useState(0);

  // useRef: en henvisning til selve <section>-elementet, så vi kan rulle hen til det
  const redigeringRef = useRef(null);

  const spiller = data.spillere.find(s => s.id === valgtId) || null;
  const antalSkadede = data.spillere.filter(s => aktivSkade(s)).length;

  // Klik på en række åbner spilleren i redigeringen
  function aabnSpiller(id) {
    setValgtId(id);
    setOpretterNy(false);
    setStartBesked("");
    setUdgave(u => u + 1);
    rulTilPaaSmalSkaerm(redigeringRef.current);
  }

  // Klik på "+ Ny spiller"
  function nySpiller() {
    setValgtId(null);
    setOpretterNy(true);
    setStartBesked("");
    setUdgave(u => u + 1);
    rulTilPaaSmalSkaerm(redigeringRef.current);
  }

  // En ny spiller er gemt: åbn ham, og bliv på Oplysninger så man kan se "Gemt ✓"
  function nyOprettet(id) {
    setValgtId(id);
    setOpretterNy(false);
    setFane("info");
    setStartBesked("Gemt ✓");
  }

  function spillerSlettet() {
    setValgtId(null);
    setOpretterNy(false);
  }

  return (
    <main className="side side-spillere">

      {/* Venstre: tabellen med hele truppen */}
      <section className="kort">
        <div className="liste-top">
          <div>
            <h2>Truppen</h2>
            <p className="opsummering">{data.spillere.length} spillere · {antalSkadede} skadet</p>
          </div>
          <button className="knap knap-primaer" onClick={nySpiller}>+ Ny spiller</button>
        </div>

        <table className="spiller-tabel">
          <thead>
            <tr><th>#</th><th>Navn</th><th>Position</th><th>Sekundær</th><th>Kampe</th><th>Mål</th><th>Status</th></tr>
          </thead>
          <tbody>
            {sorteretTrup(data.spillere).map(s => {
              const rolle = ROLLER[s.rolle];
              const skade = aktivSkade(s);
              return (
                // key={s.id}: React bruger key til at holde styr på hver række i listen
                <tr key={s.id} className={s.id === valgtId ? "valgt" : ""} onClick={() => aabnSpiller(s.id)}>
                  <td><span className="mini-nummer" style={{ background: rolle.farve, color: rolle.tekst }}>{s.nummer}</span></td>
                  <td className="navn-celle">{s.navn}</td>
                  <td><RolleChip kode={s.rolle} /></td>
                  <td>{s.sekundaer ? <RolleChip kode={s.sekundaer} /> : <span className="svag">–</span>}</td>
                  <td>{s.kampe.length}</td>
                  <td><b>{sumAf(s.kampe, "maal")}</b></td>
                  <td>
                    {skade
                      ? <span className="status-chip skadet">🩹 {skade.type}</span>
                      : <span className="status-chip klar">Klar</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* Højre: redigering af den valgte spiller */}
      <section className="kort redigering" ref={redigeringRef}>
        {spiller || opretterNy ? (
          <SpillerEditor
            key={`${valgtId ?? "ny"}-${udgave}`}
            spiller={spiller}
            fane={fane}
            onFane={setFane}
            onOprettet={nyOprettet}
            onSlettet={spillerSlettet}
            startBesked={startBesked}
          />
        ) : (
          // Vises når ingen spiller er valgt
          <div className="tom-tekst" style={{ marginTop: 40 }}>
            Vælg en spiller i listen<br />eller opret en ny.
          </div>
        )}
      </section>
    </main>
  );
}
