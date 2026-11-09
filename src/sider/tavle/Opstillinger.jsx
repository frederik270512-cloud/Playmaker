/*
  GEMTE OPSTILLINGER – et "øjebliksbillede" af tavlen: hvem står hvor,
  hvor pladserne står, og hvordan modstanderne står.
  Vi gemmer KOPIER, så senere ændringer på tavlen ikke rører den gemte opstilling.
*/
import { useState } from "react";
import { useData } from "../../DataKontekst.jsx";
import { useDialog } from "../../komponenter/Dialog.jsx";
import { standardPladsPositioner } from "../../data/standardData.js";

export default function Opstillinger() {
  const { data, opdater } = useData();
  const { bekraeftSlet } = useDialog();
  // Teksten i navnefeltet. Feltet er "kontrolleret": React bestemmer, hvad der står i det.
  const [navn, setNavn] = useState("");

  function gem() {
    const nytNavn = navn.trim() || `Opstilling ${data.opstillinger.length + 1}`;
    opdater(d => {
      d.opstillinger.push({
        id: Date.now(),
        navn: nytNavn,
        // structuredClone = en dyb kopi, så den gemte ikke deler objekter med tavlen
        opstilling: { ...d.opstilling },
        pladsPositioner: structuredClone(d.pladsPositioner),
        modstander: structuredClone(d.modstander),
        tavleHelBane: d.tavleHelBane === true,   // halv eller hel bane
      });
    });
    setNavn("");
  }

  function hent(gemt) {
    opdater(d => {
      const findes = id => d.spillere.some(s => s.id === id);
      // Spillere der er blevet slettet siden, springes over
      for (const plads in d.opstilling) {
        const id = gemt.opstilling[plads];
        d.opstilling[plads] = findes(id) ? id : null;
      }
      // (standardpositionerne bruges, hvis den gemte mangler en plads)
      // Banen (halv/hel) hentes også. Gamle opstillinger uden feltet er på halv bane.
      d.tavleHelBane = gemt.tavleHelBane === true;
      d.pladsPositioner = { ...standardPladsPositioner(d.tavleHelBane), ...structuredClone(gemt.pladsPositioner) };
      d.modstander.formation = gemt.modstander.formation;
      d.modstander.positioner = structuredClone(gemt.modstander.positioner);
    });
  }

  async function slet(gemt) {
    if (!(await bekraeftSlet(`Slet "${gemt.navn}"?`, "Den gemte opstilling bliver slettet."))) return;
    opdater(d => { d.opstillinger = d.opstillinger.filter(o => o.id !== gemt.id); });
  }

  return (
    <>
      <h2>📋 Opstillinger</h2>
      <div className="opstilling-gem">
        <input
          type="text"
          className="lille-input"
          maxLength={40}
          placeholder="F.eks. Start-7 mod Vestby"
          value={navn}
          onChange={e => setNavn(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") gem(); }}
        />
        <button className="knap knap-primaer knap-lille" onClick={gem}>💾 Gem</button>
      </div>
      <div>
        {data.opstillinger.length === 0 && (
          <p className="tom-tekst" style={{ margin: 0 }}>Ingen gemte opstillinger endnu.</p>
        )}
        {data.opstillinger.map(gemt => {
          const antal = Object.values(gemt.opstilling).filter(id => id !== null).length;
          const formation = gemt.modstander.formation;
          return (
            // key={gemt.id}: et fast id, så React kan holde styr på hvilken der er hvilken
            <div key={gemt.id} className="opstilling-punkt">
              <div className="navn">
                <b>{gemt.navn}</b>
                <small>{antal}/7 spillere · {gemt.tavleHelBane ? "hel bane · " : ""}{formation ? formation + "-forsvar" : "intet forsvar"}</small>
              </div>
              <button className="knap knap-lille" title="Sæt opstillingen på tavlen" onClick={() => hent(gemt)}>↻ Hent</button>
              <button className="slet-x" title="Slet opstilling" onClick={() => slet(gemt)}>×</button>
            </div>
          );
        })}
      </div>
    </>
  );
}
