/*
  SPILLERBRIKKEN – én af vores spillere, enten på banen eller på bænken (i panelet).

  Props (det komponenten får ind udefra, ligesom argumenter til en funktion):
    spiller      – spiller-objektet fra data.spillere
    pladsRolle   – pladsen han står på ("VB" osv.) – eller null på bænken
    valgt        – true hvis man har trykket på ham (tryk-for-at-flytte)
    flyttes      – true mens han bliver trukket (brikken bliver halvt gennemsigtig)
    onPointerDown– hvad der skal ske, når man trykker på brikken (starter et træk)
    className, style – ekstra klasser/stil (bruges til spøgelsesbrikken)
    ref          – i React 19 kan "ref" sendes som en helt almindelig prop
*/
import { ROLLER } from "../../data/konstanter.js";
import { aktivSkade, passerTilPlads } from "../../hjaelpere.js";
import { HjemmeFigur } from "../../komponenter/Figur.jsx";

export default function Brik({ spiller, pladsRolle, valgt = false, flyttes = false, onPointerDown, className = "", style, ref }) {
  const rolle = ROLLER[spiller.rolle];
  const skade = aktivSkade(spiller);

  // Tooltip når man holder musen over brikken
  let tooltip = `#${spiller.nummer} ${spiller.navn} – ${rolle.navn}`;
  if (spiller.sekundaer) tooltip += ` (sekundær: ${ROLLER[spiller.sekundaer].navn})`;
  if (skade) tooltip += `\n🩹 Skadet: ${skade.type}`;

  // Står han på banen, men ikke på sin primære eller sekundære plads? → advarsel "!"
  const forkertPlads = pladsRolle !== null && !passerTilPlads(spiller, pladsRolle);

  const klasser = "brik" +
    (skade ? " skadet" : "") +
    (valgt ? " valgt-brik" : "") +
    (flyttes ? " flyttes" : "") +
    (className ? " " + className : "");

  return (
    <div
      ref={ref}
      className={klasser}
      // CSS-variabler (--rollefarve) kan sættes i style – CSS'en bruger dem til farverne
      style={{ "--rollefarve": rolle.farve, "--rolletekst": rolle.tekst, ...style }}
      title={tooltip}
      onPointerDown={onPointerDown}
    >
      <div className="brik-figur">
        {/* Trøjen afhænger af pladsen han står på (MV = grå målmandstrøje) */}
        <HjemmeFigur rolle={pladsRolle || spiller.rolle} tekst={spiller.nummer} />
        <span className="brik-rolle">{spiller.rolle}</span>
        {skade && <span className="brik-skade">🩹</span>}
        {forkertPlads && <span className="brik-advarsel">!</span>}
      </div>
      <div className="brik-tekst">
        <span className="brik-navn">{spiller.navn}</span>
        <span className="brik-rollenavn">{rolle.navn}{skade ? " · skadet" : ""}</span>
      </div>
    </div>
  );
}
