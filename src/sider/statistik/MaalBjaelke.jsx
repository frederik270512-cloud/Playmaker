/*
  MÅL-BJÆLKE – ét personligt mål med en fremskridtsbjælke.
  Bruges både på Statistik-siden og i spillerens Historik-fane.

  Props:
    maal     – målet: { id, spillerId, type, maal, sidsteN? }
    spiller  – spilleren målet hører til (vi regner ud fra hans kampe)
    children – evt. knapper (ret/slet), som vises til højre
*/
import { formatVaerdi, maalFremskridt, maalTekst } from "./beregning.js";
import "../Statistik.css";

export default function MaalBjaelke({ maal, spiller, children }) {
  const f = maalFremskridt(maal, spiller);
  const sidsteN = Number(maal.sidsteN);
  const periode = !(Number.isInteger(sidsteN) && sidsteN > 0) ? "alle kampe"
    : sidsteN === 1 ? "seneste kamp" : `sidste ${sidsteN} kampe`;

  return (
    <div className={"maal-kort" + (f.naaet ? " naaet" : "")}>
      <div className="maal-top">
        <div className="maal-titel">
          <b>{maalTekst(maal)}</b>
          <small>{periode}</small>
        </div>
        {f.naaet && <span className="naaet-maerke">✓ Nået</span>}
        {children}
      </div>
      {/* Bjælken: role="progressbar" fortæller skærmlæsere, hvor langt man er */}
      <div className="maal-bjaelke" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(f.procent)}
           aria-label={maalTekst(maal)}>
        <div className="maal-fyld" style={{ width: f.procent + "%" }} />
      </div>
      <small className="maal-status">
        {f.vaerdi == null
          ? (f.antalKampe === 0 ? "Ingen kampe endnu" : "Ingen data endnu")
          : `Nu: ${formatVaerdi(maal.type, f.vaerdi)} (${f.antalKampe} ${f.antalKampe === 1 ? "kamp" : "kampe"}) · ${Math.round(f.procent)}% af målet`}
      </small>
    </div>
  );
}
