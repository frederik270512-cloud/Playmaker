/*
  TOPSCORER-LISTEN – hele truppen i en tabel.

  Klik på en kolonneoverskrift for at sortere efter den kolonne.
  Klikker man igen på samme kolonne, vendes rækkefølgen om.
  Top 3 målscorere får en medalje og en farvet række.

  Kolonnerne "Spilletid", "Redninger" og "Redning %" vises kun, hvis nogen
  spillere har de data (de kommer kun fra kampe gemt på Kampdag).
*/
import { useState } from "react";
import { useData } from "../../DataKontekst.jsx";
import { decimal } from "../../hjaelpere.js";
import { spillerTotaler } from "./beregning.js";

/*
  Kolonnerne i tabellen. For hver kolonne:
    noegle – feltet i spillerTotaler() (eller "navn")
    tekst  – overskriften
    titel  – forklaring når man holder musen over overskriften
    vis    – hvordan tallet skrives
    ekstra – kolonnen vises kun, hvis mindst én spiller har et tal i den
*/
const vis = v => (v == null ? "–" : v);
const visDecimal = v => (v == null ? "–" : decimal(v));
const visProcent = v => (v == null ? "–" : Math.round(v) + "%");
const KOLONNER = [
  { noegle: "kampe",        tekst: "Kampe",      vis },
  { noegle: "maal",         tekst: "Mål",        vis },
  { noegle: "maalPrKamp",   tekst: "Mål/kamp",   vis: visDecimal },
  { noegle: "assists",      tekst: "Assists",    vis },
  { noegle: "afbraendere",  tekst: "Afbrændere", vis },
  { noegle: "skudPct",      tekst: "Skud %",     vis: visProcent, titel: "Mål ÷ (mål + afbrændere)" },
  { noegle: "tekniskeFejl", tekst: "Tekn. fejl", vis },
  { noegle: "spilletidMin", tekst: "Spilletid",  vis: v => (v == null ? "–" : Math.round(v) + " min"), titel: "Gennemsnit pr. kamp (kun kampe med spilletid)", ekstra: true },
  { noegle: "redninger",    tekst: "Redninger",  vis, ekstra: true },
  { noegle: "redningPct",   tekst: "Redning %",  vis: visProcent, titel: "Redninger ÷ (redninger + mål imod)", ekstra: true },
];

const MEDALJER = ["🥇", "🥈", "🥉"];

export default function Topscorere() {
  const { data } = useData();
  // Hvilken kolonne der sorteres efter, og om det er faldende (størst først)
  const [sortering, setSortering] = useState({ noegle: "maal", faldende: true });

  // Én række pr. spiller: spilleren + alle hans tal
  const raekker = data.spillere.map(s => ({ spiller: s, ...spillerTotaler(s) }));

  // De "ekstra" kolonner vises kun, hvis der er data i dem
  const kolonner = KOLONNER.filter(k => !k.ekstra || raekker.some(r => r[k.noegle] != null));

  // Top 3 målscorere (kun spillere der HAR scoret). Ved lige mange mål vinder den med flest mål pr. kamp.
  const top3 = [...raekker]
    .filter(r => r.maal > 0)
    .sort((a, b) => b.maal - a.maal || (b.maalPrKamp ?? 0) - (a.maalPrKamp ?? 0))
    .slice(0, 3)
    .map(r => r.spiller.id);

  // Sortér rækkerne. Tomme tal ("–") kommer altid nederst, uanset retning.
  const { noegle, faldende } = sortering;
  const sorteret = [...raekker].sort((a, b) => {
    if (noegle === "navn") {
      const forskel = a.spiller.navn.localeCompare(b.spiller.navn, "da");
      return faldende ? -forskel : forskel;
    }
    const va = a[noegle], vb = b[noegle];
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    return faldende ? vb - va : va - vb;
  });

  // Klik på en overskrift: ny kolonne → faldende (navn: A-Å). Samme kolonne → vend om.
  function sorterEfter(nyNoegle) {
    setSortering(gammel => gammel.noegle === nyNoegle
      ? { noegle: nyNoegle, faldende: !gammel.faldende }
      : { noegle: nyNoegle, faldende: nyNoegle !== "navn" });
  }

  /*
    En overskrift der kan klikkes på. aria-sort fortæller skærmlæsere, hvordan der er sorteret.
    (Det er en almindelig funktion – ikke en komponent – så knappen ikke bliver lavet
    forfra ved hver tegning. Ellers ville den miste fokus, når man klikker på den.)
  */
  function overskrift(kolonneNoegle, tekst, titel, klasse = "tal") {
    const aktiv = noegle === kolonneNoegle;
    return (
      <th key={kolonneNoegle} className={klasse} aria-sort={aktiv ? (faldende ? "descending" : "ascending") : "none"}>
        <button type="button" className={"sorter-knap" + (aktiv ? " aktiv" : "")} title={titel} onClick={() => sorterEfter(kolonneNoegle)}>
          {tekst}<span className="sorter-pil">{aktiv ? (faldende ? "▼" : "▲") : "↕"}</span>
        </button>
      </th>
    );
  }

  if (raekker.length === 0) return <p className="tom-tekst">Der er ingen spillere i truppen endnu.</p>;

  return (
    // Tabellen kan scrolle sidelæns inde i kortet på smalle skærme
    <div className="tabel-rulle">
      <table className="kamp-tabel stat-tabel">
        <thead>
          <tr>
            <th className="tal">#</th>
            {overskrift("navn", "Spiller", "Sortér efter navn", "")}
            {kolonner.map(k => overskrift(k.noegle, k.tekst, k.titel))}
          </tr>
        </thead>
        <tbody>
          {sorteret.map(r => {
            const plads = top3.indexOf(r.spiller.id);       // -1 = ikke i top 3
            return (
              <tr key={r.spiller.id} className={plads >= 0 ? `top-${plads + 1}` : ""}>
                <td className="tal">{r.spiller.nummer}</td>
                <td className="stat-navn-celle">
                  {plads >= 0 && <span className="medalje" title={`Nr. ${plads + 1} på topscorerlisten`}>{MEDALJER[plads]} </span>}
                  <b>{r.spiller.navn}</b> <small>{r.spiller.rolle}</small>
                </td>
                {kolonner.map(k => (
                  <td key={k.noegle} className={"tal" + (k.noegle === noegle ? " sorteret" : "")}>
                    {k.noegle === "maal" ? <b>{k.vis(r[k.noegle])}</b> : k.vis(r[k.noegle])}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
