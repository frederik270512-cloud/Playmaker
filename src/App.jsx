/*
  APP – toppen af siden (titel, faner, gem/hent fil) og den side der vises lige nu.
*/
import { useCallback, useEffect, useRef, useState } from "react";
import { useData } from "./DataKontekst.jsx";
import { useDialog } from "./komponenter/Dialog.jsx";
import { NavigationKontekst } from "./Navigation.jsx";
import { normaliser } from "./data/lagring.js";
import { tommeData } from "./data/standardData.js";
import { idagISO } from "./hjaelpere.js";

import Spillere from "./sider/Spillere.jsx";
import Taktiktavle from "./sider/Taktiktavle.jsx";
import Systemer from "./sider/Systemer.jsx";
import Oversigt from "./sider/Oversigt.jsx";
import Kampdag from "./sider/Kampdag.jsx";

// Fanerne: navn i adressen (#tavle), tekst på knappen og hvilken komponent der vises
const SIDER = [
  { id: "spillere", tekst: "Spillere",    Komponent: Spillere },
  { id: "tavle",    tekst: "Taktiktavle", Komponent: Taktiktavle },
  { id: "systemer", tekst: "Systemer",    Komponent: Systemer },
  { id: "oversigt", tekst: "Oversigt",    Komponent: Oversigt },
  { id: "kampdag",  tekst: "⏱️ Kampdag",  Komponent: Kampdag },
];

// Start på den side der står i adressen (fx #tavle) – ellers Spillere
function sideFraAdresse() {
  const navn = window.location.hash.slice(1);
  return SIDER.some(s => s.id === navn) ? navn : "spillere";
}

export default function App() {
  const { data, erstat } = useData();
  const { spoerg } = useDialog();
  const [side, setSide] = useState(sideFraAdresse);
  const forladVagt = useRef(null);       // se Navigation.jsx
  const filFelt = useRef(null);

  // Husk siden i adressen, så en genindlæsning bliver på samme side
  useEffect(() => {
    if (window.location.hash !== "#" + side) window.location.hash = side;
  }, [side]);

  // Ændres adressen (fx med browserens frem/tilbage-knapper), skifter vi side
  useEffect(() => {
    const vedAendring = () => {
      const ny = sideFraAdresse();
      if (ny !== side) skiftSide(ny);
    };
    window.addEventListener("hashchange", vedAendring);
    return () => window.removeEventListener("hashchange", vedAendring);   // ryd op
  });

  const saetForladVagt = useCallback((fn) => { forladVagt.current = fn; }, []);

  async function skiftSide(nySide) {
    if (nySide === side) return;          // klik på den fane man allerede står på → intet sker
    if (forladVagt.current && !(await forladVagt.current())) return;   // "Bliv her"
    setSide(nySide);
  }

  /* ---------- EKSPORT: gem alle data som en fil ---------- */
  function eksporter() {
    const tekst = JSON.stringify(data, null, 2);
    const fil = new Blob([tekst], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(fil);
    link.download = `playmaker-${idagISO()}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  /* ---------- IMPORT: hent data fra en fil ---------- */
  async function importer(e) {
    const fil = e.target.files[0];
    e.target.value = "";                 // så man kan vælge den samme fil igen
    if (!fil) return;

    let ind = null;
    try {
      ind = JSON.parse(await fil.text());
    } catch {
      ind = null;
    }
    if (!ind || !Array.isArray(ind.spillere)) {
      await spoerg("Kunne ikke læse filen", "Filen er ikke en gyldig Playmaker- eller taktiktavle-fil.",
        [{ tekst: "OK", svar: true }]);
      return;
    }
    const svar = await spoerg("Hent data fra fil?",
      `Filen indeholder ${ind.spillere.length} spillere, ${(ind.systemer || []).length} systemer ` +
      `og ${(ind.modstandere || []).length} modstanderhold.\n\nAlt det, der er i appen nu, bliver erstattet.`, [
        { tekst: "Annuller", svar: false },
        { tekst: "📂 Ja, hent", svar: true, stil: "knap-primaer" },
      ]);
    if (svar !== true) return;
    erstat(normaliser(ind, tommeData()));
    await spoerg("Data hentet ✓", "Alt fra filen er nu lagt ind.", [{ tekst: "OK", svar: true, stil: "knap-primaer" }]);
  }

  const AktivSide = SIDER.find(s => s.id === side).Komponent;

  return (
    <NavigationKontekst.Provider value={{ saetForladVagt, skiftSide }}>
      <header>
        <div className="header-venstre">
          <h1>🤾 Playmaker</h1>
          <nav className="faner">
            {SIDER.map(s => (
              <button
                key={s.id}
                className={"fane" + (s.id === side ? " aktiv" : "")}
                onClick={() => skiftSide(s.id)}
              >
                {s.tekst}
              </button>
            ))}
          </nav>
        </div>
        <div className="data-knapper">
          <button className="knap knap-lille" onClick={eksporter} title="Gem alle data som en fil">💾 Gem fil</button>
          <button className="knap knap-lille" onClick={() => filFelt.current.click()} title="Hent data fra en fil">📂 Hent fil</button>
          <input ref={filFelt} type="file" accept=".json,application/json" hidden onChange={importer} />
        </div>
      </header>

      {/* key={side}: siden starter forfra, hver gang man skifter fane */}
      <AktivSide key={side} />
    </NavigationKontekst.Provider>
  );
}
