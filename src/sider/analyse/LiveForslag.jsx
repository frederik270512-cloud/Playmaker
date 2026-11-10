/*
  LIVE-FORSLAG – vises på Kampdag (kompakt) og på Analyse-siden.
  Opdaterer sig selv, hver gang der sker noget på Kampdag (alt regnes ud i live.js).
  Modstanderen findes på Oversigt ud fra navnet, der er skrevet på Kampdag.
*/
import { useMemo } from "react";
import { useData } from "../../DataKontekst.jsx";
import { liveForslag, findModstander } from "./live.js";
import "../Analyse.css";       // .raad-stylingen deles med Analyse-siden

export default function LiveForslag({ kampdag, kompakt = false }) {
  const { data } = useData();
  const modstander = findModstander(data, kampdag?.modstander);
  const raad = useMemo(() => liveForslag(kampdag, data.spillere, modstander), [kampdag, data.spillere, modstander]);

  if (raad.length === 0) {
    return (
      <p className="tom-tekst live-tom">
        Ingen forslag endnu. De kommer, når der er registreret nogle hændelser
        {modstander ? "" : " (skriv modstanderens navn som på Oversigt, så bruges dine noter om dem)"}.
      </p>
    );
  }
  const vist = kompakt ? raad.slice(0, 4) : raad;
  return (
    <div className="analyse-raad live-raad">
      {vist.map((r, i) => (
        <div key={i} className={"raad" + (r.vigtig ? " raad-vigtig" : "")}>
          <span className="raad-ikon">{r.ikon}</span>
          <div><strong>{r.titel}</strong><p>{r.tekst}</p></div>
        </div>
      ))}
      {kompakt && raad.length > 4 && <small className="live-flere">+ {raad.length - 4} flere under 🔥 Analyse</small>}
    </div>
  );
}
