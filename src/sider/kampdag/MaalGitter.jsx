/*
  MÅLGITTER – to små komponenter til skudkortet:

  <MaalGitter kort={...} imod={false} />
    Tegner målet som 3 × 3 felter med tal i hvert felt.
    kort = { "hoej-venstre": { maal: 2, afb: 1 }, ... }
    Farven: grøn = mange mål, rød = mange afbrændere. Jo flere skud i et felt,
    jo kraftigere farve. imod = true bruges til modstanderens mål (kun mål, altid rød).

  <HjoerneVaelger titel="..." onVaelg={noegle => ...} onSpringOver={() => ...} />
    Den lille boks der spørger "Hvor i målet?" efter et skud.
    Man kan altid trykke "Spring over" (eller Escape), så registreringen går hurtigt.
*/
import { useEffect, useRef } from "react";
import { HJOERNE_NOEGLER, KOLONNER, RAEKKER, hjoerneNavn } from "./maalHjoerner.js";
import "../Kampdag.css";

export function MaalGitter({ kort, imod = false }) {
  const tal = noegle => {
    const felt = kort?.[noegle] || {};
    return { maal: Number(felt.maal) || 0, afb: Number(felt.afb) || 0 };
  };
  // Det felt med flest skud bestemmer, hvad "fuld farve" er
  const flest = Math.max(1, ...HJOERNE_NOEGLER.map(n => tal(n).maal + tal(n).afb));

  return (
    <div className="maal-gitter" role="table" aria-label="Skudkort: målet set fra skytten">
      {HJOERNE_NOEGLER.map(noegle => {
        const { maal, afb } = tal(noegle);
        const ialt = maal + afb;
        // Farvetone: 120 = grøn (kun mål), 0 = rød (kun afbrændere). Mod os er mål altid røde.
        const tone = imod ? 0 : Math.round((maal / (ialt || 1)) * 120);
        const styrke = ialt ? 0.25 + 0.65 * (ialt / flest) : 0;
        return (
          <div
            key={noegle}
            role="cell"
            className="maal-felt"
            title={hjoerneNavn(noegle) + (imod ? `: ${maal} mål imod` : `: ${maal} mål, ${afb} afbrændere`)}
            style={{ background: ialt ? `hsla(${tone}, 70%, 45%, ${styrke})` : undefined }}
          >
            {ialt === 0 ? <span className="maal-felt-tom">·</span> : imod ? (
              <b>{maal}</b>
            ) : (
              <>
                {maal > 0 && <span className="maal-felt-maal">{maal}⚽</span>}
                {afb > 0 && <span className="maal-felt-afb">{afb}❌</span>}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function HjoerneVaelger({ titel, onVaelg, onSpringOver }) {
  const dialogRef = useRef(null);

  // Vis boksen som "modal" (oven på alt andet), så snart den er tegnet
  useEffect(() => {
    const el = dialogRef.current;
    if (el && !el.open) el.showModal();
    return () => { if (el && el.open) el.close(); };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="dialog hjoerne-dialog"
      onCancel={e => { e.preventDefault(); onSpringOver(); }}   // Escape = spring over
    >
      <h3>{titel}</h3>
      <p className="hjoerne-hjaelp">Hvor i målet? (set fra skytten)</p>
      <div className="hjoerne-valg">
        {RAEKKER.map(r => KOLONNER.map(k => {
          const noegle = `${r.id}-${k.id}`;
          return (
            <button key={noegle} type="button" className="hjoerne-knap" onClick={() => onVaelg(noegle)}>
              {r.navn}<br /><small>{k.navn}</small>
            </button>
          );
        }))}
      </div>
      <div className="dialog-knapper">
        <button type="button" className="knap" autoFocus onClick={onSpringOver}>Spring over</button>
      </div>
    </dialog>
  );
}
