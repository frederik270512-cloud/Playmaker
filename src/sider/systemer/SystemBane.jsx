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
    trinNavn(index)      – (valgfri) navnet på et trin til skiltet, fx "4A" for et variant-trin.
                           Uden den hedder trinene bare 1, 2, 3 ...

  Har systemet varianter, får banen det "effektive" system (fælles trin + den valgte
  variants trin i én liste – se systemVarianter.js), så her er alt som før.

  Har systemet helBane: true, tegnes den HELE bane (se helBane.js og BaneSVG.jsx), og
  alle omregninger mellem skærm og bane bruger den hele banes viewBox.
*/
import { useRef, useState } from "react";
import BaneSVG from "../../komponenter/BaneSVG.jsx";
import { SystemFigur } from "../../komponenter/Figur.jsx";
import { PileLag, TrinPile } from "../../komponenter/Pile.jsx";
import { MAAL } from "../../data/konstanter.js";
import { angribereIPos, erForsvarssystem, erVores, brikNavn, rolleInfo } from "../../systemRoller.js";
import { tilstandVed, boldPosition, erSkud } from "../../animation.js";
import { tilProcentI, skaermTilBaneI, begraens, baneViewBox, viewBoxTekst, bundGraense } from "../../hjaelpere.js";
import "./Systemer.css";

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
  // Kun angriberne kan gribe bolden (også i et forsvarssystem – der er det modstanderen)
  for (const noegle of angribereIPos(pos)) {
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

// Standard: trin nr. 0 hedder "1", trin nr. 1 hedder "2" osv.
const almindeligtTrinNavn = (index) => String(index + 1);

export default function SystemBane({
  system, tid, trinIndex, kanRedigere, aendrTrin, spillerNavn, trinNavn = almindeligtTrinNavn,
}) {
  // useRef til selve banens <div>, så vi kan omregne musens pixels til banens koordinater
  const baneRef = useRef(null);
  // Oplysninger om det træk der er i gang (behøver ikke vises → ref i stedet for state)
  const traek = useRef(null);
  // Hvilken brik bliver trukket lige nu? (state, fordi den får klassen "trukket")
  const [trukket, setTrukket] = useState(null);

  const t = tilstandVed(system, tid);
  const bp = boldPosition(t);
  // Forsvarssystem? Så er VI forsvaret (se systemRoller.js) – trøjer og pile bytter rolle
  const forsvar = erForsvarssystem(system);
  /*
    Hel bane (kontra/omstilling)? Så bruger vi den hele banes koordinater (se helBane.js):
    vb = banens viewBox, bund = hvor langt ned man må trække (ind i vores eget mål).
    tilProcent/skaermTilBane er her de udgaver, der passer til den rigtige viewBox.
  */
  const helBane = system.helBane === true;
  const vb = baneViewBox(helBane);
  const bund = bundGraense(helBane);
  const tilProcent = (x, y) => tilProcentI(vb, x, y);
  const skaermTilBane = (element, x, y) => skaermTilBaneI(vb, element, x, y);

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
      y: begraens(p.y + tr.forskydning.y, -20, bund),
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
    const bold = { x: begraens(p.x, -10, 210), y: begraens(p.y, -15, bund) };
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
    ? <PileLag synlighed={1} viewBox={viewBoxTekst(vb)}>
        <TrinPile fraTrin={trinIndex > 0 ? system.trin[trinIndex - 1] : null} tilTrin={system.trin[trinIndex]}
                  forsvar={forsvar} />
      </PileLag>
    : <PileLag synlighed={0.45} viewBox={viewBoxTekst(vb)}>
        <TrinPile fraTrin={system.trin[t.fraIndex]} tilTrin={system.trin[t.fraIndex + 1]} forsvar={forsvar} />
      </PileLag>;

  const skilt = trinIndex !== null
    ? `Trin ${trinNavn(trinIndex)} af ${system.trin.length}` + (erSkud(system.trin[trinIndex].bold) ? " · 🥅 Skud på mål!" : "")
    : `Trin ${trinNavn(t.fraIndex)} → ${trinNavn(t.fraIndex + 1)}`;

  return (
    // "laast" = man kan ikke redigere lige nu (seer, afspilning eller mellem to trin)
    // "hel" = hel bane (højere og smallere – se Systemer.css)
    <div ref={baneRef} className={"system-bane" + (kanRedigere ? "" : " laast") + (helBane ? " hel" : "")}>
      {/* Banen SKAL være det første barn (CSS: .system-bane > svg:first-child giver skygge) */}
      <BaneSVG helBane={helBane} forsvar={forsvar} />
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

      {/* Brikkerne. Object.keys(trin 1) = alle pladser i systemet (VF, VB, ..., evt. ST2, M0..M6) */}
      {Object.keys(system.trin[0].pos).map((noegle) => {
        const p = t.pos[noegle];
        if (!p) return null;
        const erM = noegle.startsWith("M");
        // "modst" (lidt mindre brik) = modstanderen – det er M-nøglerne i angreb, angriberne i forsvar
        const modst = !erVores(system, noegle);
        const klasse = "sbrik" + (modst ? " modst" : "") + (trukket === noegle ? " trukket" : "");
        // Navne fra taktiktavlen vises kun på vores angribere (ikke i forsvarssystemer)
        const navn = !forsvar && !erM ? spillerNavn(noegle) : "";
        let titel;
        if (erM) {
          const nr = Number(noegle.slice(1));      // "M3" → 3
          titel = forsvar
            ? (nr === 0 ? "Vores målmand" : `Vores forsvarer ${nr}`)
            : (nr === 0 ? "Modstanderens målmand" : `Forsvarsspiller ${nr}`);
        } else if (noegle === "VM") {
          // Målmanden for holdet med bolden (kun på hel bane)
          titel = forsvar ? "Modstanderens målmand" : "Vores målmand – klik for at give bolden";
        } else {
          titel = (forsvar ? `Modstanderens ${brikNavn(noegle)}` : rolleInfo(noegle).navn) + " – klik for at give bolden";
        }
        return (
          <div
            key={noegle}
            className={klasse}
            style={tilProcent(p.x, p.y)}
            title={titel}
            onPointerDown={(e) => brikNed(e, noegle)}
            onPointerMove={brikFlyt}
            onPointerUp={brikOp}
            onPointerCancel={brikOp}
          >
            <SystemFigur noegle={noegle} forsvar={forsvar} />
            {navn && <span className="sbrik-navn">{navn}</span>}
          </div>
        );
      })}
    </div>
  );
}
