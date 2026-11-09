/*
  SYSTEM-BANEN – banen med brikker, bold, pile og "Trin 2 af 4"-skiltet.
  Her bor også træk-logikken (pointer events), når man redigerer.

  Props:
    system       – det system der vises (den lokale arbejdskopi, når man redigerer)
    tid          – hvor i animationen vi er (se useAfspilning.js)
    trinIndex    – det trin vi står på, eller null mellem to trin
    kanRedigere  – må man flytte brikker/bold lige nu?
    aendrTrin(index, fn) – ændr trin nr. index: fn får det gamle trin og giver et NYT trin tilbage
    spillerNavn(noegle)  – navnet på spilleren der står på pladsen (fra taktiktavlen), eller ""
*/
import { useRef, useState } from "react";
import BaneSVG from "../../komponenter/BaneSVG.jsx";
import { HjemmeFigur, ModstanderFigur } from "../../komponenter/Figur.jsx";
import { PileLag, TrinPile } from "../../komponenter/Pile.jsx";
import { ANGRIBERE, ROLLER, MAAL } from "../../data/konstanter.js";
import { tilstandVed, boldPosition, erSkud } from "../../animation.js";
import { tilProcent, skaermTilBane, begraens } from "../../hjaelpere.js";

/*
  Når man slipper bolden:
    - tæt på en af vores spillere (under 14 enheder = 1,4 m) → han griber den
    - tæt på/inde i målet → skud: bolden lægges lige inden for stolperne
    - ellers → bolden ligger frit på banen (kastet ud i rummet)
  Funktionen er "ren": den ændrer intet, men giver den nye bold tilbage.
*/
function landBold(bold, pos) {
  if (typeof bold !== "object" || bold === null) return bold;

  let naermest = null;
  let kortesteAfstand = 14;
  for (const noegle of ANGRIBERE) {
    const p = pos[noegle];
    if (!p) continue;
    const afstand = Math.hypot(p.x - bold.x, p.y - bold.y);
    if (afstand < kortesteAfstand) {
      kortesteAfstand = afstand;
      naermest = noegle;
    }
  }
  if (naermest) return naermest;

  if (bold.y < MAAL.bund + 4 && bold.x > MAAL.venstre - 4 && bold.x < MAAL.hoejre + 4) {
    return {
      x: begraens(bold.x, MAAL.venstre + 2, MAAL.hoejre - 2),
      y: begraens(bold.y, MAAL.top + 2, MAAL.bund - 2),
    };
  }
  return bold;
}

export default function SystemBane({ system, tid, trinIndex, kanRedigere, aendrTrin, spillerNavn }) {
  // useRef til selve banens <div>, så vi kan omregne musens pixels til banens koordinater
  const baneRef = useRef(null);
  // Oplysninger om det træk der er i gang (behøver ikke vises → ref i stedet for state)
  const traek = useRef(null);
  // Hvilken brik bliver trukket lige nu? (state, fordi den får klassen "trukket")
  const [trukket, setTrukket] = useState(null);

  const t = tilstandVed(system, tid);
  const bp = boldPosition(t);

  /* ---------- Træk brikker (Pointer Events: virker med mus, pen og finger) ----------
     pointerdown → man trykker, pointermove → musen flyttes, pointerup → man slipper.
     pointercancel (fx hvis browseren afbryder et touch-træk) behandles som at slippe.
     Flyttes musen under 4 pixels, tæller det som et KLIK → spilleren får bolden.
  */
  function brikNed(e, noegle) {
    if (!kanRedigere) return;
    e.preventDefault();
    // setPointerCapture: brikken bliver ved med at få events, selv hvis musen smutter væk fra den
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ikke afgørende – virker også uden */ }
    const nu = system.trin[trinIndex].pos[noegle];
    const mus = skaermTilBane(baneRef.current, e.clientX, e.clientY);
    traek.current = {
      type: "brik",
      noegle,
      index: trinIndex,
      startMus: { x: e.clientX, y: e.clientY },
      // Afstanden fra musen til brikkens midte, så brikken ikke "hopper" når man griber den
      forskydning: { x: nu.x - mus.x, y: nu.y - mus.y },
      erFlyttet: false,
    };
  }

  function brikFlyt(e) {
    const tr = traek.current;
    if (!tr || tr.type !== "brik") return;
    // Først når musen er flyttet mere end 4 pixels, regner vi det som et træk
    if (!tr.erFlyttet && Math.hypot(e.clientX - tr.startMus.x, e.clientY - tr.startMus.y) < 4) return;
    if (!tr.erFlyttet) {
      tr.erFlyttet = true;
      setTrukket(tr.noegle);
    }
    const p = skaermTilBane(baneRef.current, e.clientX, e.clientY);
    const nyPos = {
      x: begraens(p.x + tr.forskydning.x, -10, 210),
      y: begraens(p.y + tr.forskydning.y, -20, 210),
    };
    // Kun den lokale arbejdskopi ændres – ikke hele appens data
    aendrTrin(tr.index, trin => ({ ...trin, pos: { ...trin.pos, [tr.noegle]: nyPos } }));
  }

  function brikOp() {
    const tr = traek.current;
    if (!tr || tr.type !== "brik") return;
    traek.current = null;
    setTrukket(null);
    // Et klik (uden træk) på en af vores spillere giver ham bolden
    if (!tr.erFlyttet && !tr.noegle.startsWith("M")) {
      aendrTrin(tr.index, trin => (trin.bold === tr.noegle ? trin : { ...trin, bold: tr.noegle }));
    }
  }

  /* ---------- Træk bolden (kast den) ---------- */
  function boldNed(e) {
    if (!kanRedigere) return;
    e.preventDefault();
    e.stopPropagation();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ikke afgørende – virker også uden */ }
    traek.current = { type: "bold", index: trinIndex, erFlyttet: false };
  }

  function boldFlyt(e) {
    const tr = traek.current;
    if (!tr || tr.type !== "bold") return;
    tr.erFlyttet = true;
    const p = skaermTilBane(baneRef.current, e.clientX, e.clientY);
    const bold = { x: begraens(p.x, -10, 210), y: begraens(p.y, -15, 210) };
    aendrTrin(tr.index, trin => ({ ...trin, bold }));
  }

  function boldOp() {
    const tr = traek.current;
    if (!tr || tr.type !== "bold") return;
    traek.current = null;
    if (tr.erFlyttet) aendrTrin(tr.index, trin => ({ ...trin, bold: landBold(trin.bold, trin.pos) }));
  }

  /* ---------- Pilene ----------
     Står vi på et trin, viser vi hvad der skete for at komme HERTIL (tydeligt).
     Mellem to trin viser vi svagt det, der er ved at ske. */
  const pile = trinIndex !== null
    ? <PileLag synlighed={1}>
        <TrinPile fraTrin={trinIndex > 0 ? system.trin[trinIndex - 1] : null} tilTrin={system.trin[trinIndex]} />
      </PileLag>
    : <PileLag synlighed={0.45}>
        <TrinPile fraTrin={system.trin[t.fraIndex]} tilTrin={system.trin[t.fraIndex + 1]} />
      </PileLag>;

  const skilt = trinIndex !== null
    ? `Trin ${trinIndex + 1} af ${system.trin.length}` + (erSkud(system.trin[trinIndex].bold) ? " · 🥅 Skud på mål!" : "")
    : `Trin ${t.fraIndex + 1} → ${t.fraIndex + 2}`;

  return (
    // "laast" = man kan ikke redigere lige nu (seer, afspilning eller mellem to trin)
    <div ref={baneRef} className={"system-bane" + (kanRedigere ? "" : " laast")}>
      {/* Banen SKAL være det første barn (CSS: .system-bane > svg:first-child giver skygge) */}
      <BaneSVG />
      {pile}

      {/* Bolden – glider fra hvor den var (spiller eller punkt) til hvor den skal hen */}
      <div
        className="bold"
        style={tilProcent(bp.x, bp.y)}
        onPointerDown={boldNed}
        onPointerMove={boldFlyt}
        onPointerUp={boldOp}
        onPointerCancel={boldOp}
      />

      <div className="trin-skilt">{skilt}</div>

      {/* Brikkerne. Object.keys(trin 1) = alle pladser i systemet (VF, VB, ..., M0..M6) */}
      {Object.keys(system.trin[0].pos).map((noegle) => {
        const p = t.pos[noegle];
        if (!p) return null;
        const modst = noegle.startsWith("M");
        const klasse = "sbrik" + (modst ? " modst" : "") + (trukket === noegle ? " trukket" : "");
        const navn = modst ? "" : spillerNavn(noegle);
        const nr = Number(noegle.slice(1));        // "M3" → 3
        return (
          <div
            key={noegle}
            className={klasse}
            style={tilProcent(p.x, p.y)}
            title={modst
              ? (nr === 0 ? "Modstanderens målmand" : `Forsvarsspiller ${nr}`)
              : `${ROLLER[noegle]?.navn ?? noegle} – klik for at give bolden`}
            onPointerDown={(e) => brikNed(e, noegle)}
            onPointerMove={brikFlyt}
            onPointerUp={brikOp}
            onPointerCancel={brikOp}
          >
            {modst
              ? <ModstanderFigur nr={nr} />
              : <HjemmeFigur rolle={noegle} tekst={noegle} />}
            {navn && <span className="sbrik-navn">{navn}</span>}
          </div>
        );
      })}
    </div>
  );
}
