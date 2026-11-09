/*
  SKADEHISTORIK – listen over en spillers skader (nyeste først) og formularen
  til at tilføje en ny skade. Vises kun for spillere, der allerede er gemt.

  Props:
    spiller – den spiller hvis skader vises
*/
import { useState } from "react";
import { useData } from "../../DataKontekst.jsx";
import { useDialog } from "../../komponenter/Dialog.jsx";
import { idagISO, formatDato, dageMellem, erAktiv, nytId } from "../../hjaelpere.js";

export default function Skader({ spiller }) {
  const { opdater } = useData();
  const { bekraeftSlet } = useDialog();

  // Felterne i "tilføj skade"-formularen. Hvert felt har sin egen useState,
  // og <input value={...} onChange={...}> holder feltet og tilstanden ens ("kontrolleret felt").
  const [type, setType] = useState("");
  const [fra, setFra] = useState(idagISO);
  const [til, setTil] = useState("");
  const [note, setNote] = useState("");
  const [besked, setBesked] = useState("");

  // Lille hjælper: ret i DENNE spiller inde i opdater()
  function aendrSpiller(aendring) {
    opdater(d => {
      const s = d.spillere.find(x => x.id === spiller.id);
      if (s) aendring(s);
    });
  }

  function raskmeld(skadeId) {
    aendrSpiller(s => {
      const skade = s.skader.find(sk => sk.id === skadeId);
      if (skade) skade.til = idagISO();
    });
  }

  async function sletSkade(skade) {
    if (!(await bekraeftSlet("Slet skade?", `Skaden "${skade.type}" bliver slettet fra historikken.`))) return;
    aendrSpiller(s => { s.skader = s.skader.filter(sk => sk.id !== skade.id); });
  }

  // Kører når man trykker "+ Tilføj skade"
  function tilfoejSkade(e) {
    e.preventDefault();      // en <form> ville ellers genindlæse siden
    if (til && til < fra) {
      setBesked("Slutdatoen skal være efter startdatoen.");
      return;
    }
    const ny = { id: nytId(), type: type.trim(), fra, til, note: note.trim() };
    aendrSpiller(s => { s.skader.push(ny); });

    // Tøm felterne igen
    setType("");
    setFra(idagISO());
    setTil("");
    setNote("");
    setBesked("");
  }

  // Sortér så den nyeste skade står øverst ([...] laver en kopi – sort() må ikke ændre data direkte)
  const sorteret = [...spiller.skader].sort((a, b) => b.fra.localeCompare(a.fra));

  return (
    <div>
      <div>
        {sorteret.length === 0 && <p className="tom-tekst">Ingen skader registreret 💪</p>}

        {sorteret.map(skade => {
          const aktiv = erAktiv(skade);
          const slut = skade.til || idagISO();          // uden slutdato regner vi til i dag
          const varighed = dageMellem(skade.fra, slut);
          return (
            <div key={skade.id} className={"skade" + (aktiv ? " aktiv" : "")}>
              <div className="skade-top">
                <b>{skade.type}</b>
                <span className={"status-chip " + (aktiv ? "skadet" : "ovre")}>{aktiv ? "Aktiv" : "Overstået"}</span>
              </div>
              <div className="skade-dato">
                {formatDato(skade.fra)} – {skade.til ? formatDato(skade.til) : "nu"} ({varighed} dage)
              </div>
              {skade.note && <div className="skade-note">{skade.note}</div>}
              <div className="skade-knapper">
                {aktiv && (
                  <button type="button" className="knap knap-lille" onClick={() => raskmeld(skade.id)}>Raskmeld i dag</button>
                )}
                <button type="button" className="knap knap-lille" onClick={() => sletSkade(skade)}>Slet</button>
              </div>
            </div>
          );
        })}
      </div>

      <form className="skade-form" onSubmit={tilfoejSkade}>
        <label className="felt">Skade
          <input type="text" placeholder="f.eks. Forstuvet ankel" maxLength={50} required
                 value={type} onChange={e => setType(e.target.value)} />
        </label>
        <div className="felt-raekke">
          <label className="felt">Fra
            <input type="date" required value={fra} onChange={e => setFra(e.target.value)} />
          </label>
          <label className="felt">Til (tom = stadig skadet)
            <input type="date" value={til} onChange={e => setTil(e.target.value)} />
          </label>
        </div>
        <label className="felt">Note
          <input type="text" placeholder="valgfri" maxLength={120}
                 value={note} onChange={e => setNote(e.target.value)} />
        </label>
        <p className={"besked" + (besked ? " fejl" : "")}>{besked}</p>
        <button type="submit" className="knap">+ Tilføj skade</button>
      </form>
    </div>
  );
}
