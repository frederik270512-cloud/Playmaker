/*
  SIDE 2: TAKTIKTAVLEN

  Venstre: banen med de 7 pladser, modstanderne, tegnelaget og (evt.) et system der afspilles.
  Højre:   panelet med værktøjer, advarsler, udskiftere, gemte opstillinger og farveforklaring.
  Kanten:  "skuffen", hvor man kan afspille et system med de spillere, der står på tavlen.

  TRÆK OG SLIP (mus, pen OG finger) med "pointer events", som virker ens med mus og touch:
    pointerdown → man trykker på en brik (vi husker hvad, i en ref)
    pointermove → en "spøgelsesbrik" følger fingeren
    pointerup   → vi finder ud af HVAD man slap over (document.elementFromPoint)
  Flytter man sig mindre end 6 pixels, tæller det som et TRYK (tryk-for-at-flytte):
    tryk på en spiller → tryk der hvor han skal hen. Det er nemt på en telefon.

  Data gemmes først, når man SLIPPER – ikke ved hver musebevægelse (det ville være langsomt).
*/
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useData } from "../DataKontekst.jsx";
import { ROLLER, PLADSER, MODSTANDER_FARVE, MODSTANDER_KANT, HJEMME } from "../data/konstanter.js";
import { startPositioner, standardPladsPositioner, tomOpstilling } from "../data/standardData.js";
import { aktivSkade, passerTilPlads, sorteretTrup, tilProcent } from "../hjaelpere.js";
import BaneSVG from "../komponenter/BaneSVG.jsx";
import { ModstanderFigur } from "../komponenter/Figur.jsx";
import Brik from "./tavle/Brik.jsx";
import Tegning from "./tavle/Tegning.jsx";
import Opstillinger from "./tavle/Opstillinger.jsx";
import Skuffe, { AfspilLag, useTavleAfspilning } from "./tavle/Skuffe.jsx";
import { findPladsFor, saetPaaPlads, sendTilPanel, skaermTilTavle } from "./tavle/tavleHjaelpere.js";

export default function Taktiktavle() {
  const { data, opdater } = useData();
  const findSpiller = id => data.spillere.find(s => s.id === id);

  /* ---------- STATE (det siden selv skal huske) ---------- */
  // Spilleren man har trykket på (tryk-for-at-flytte) – eller null
  const [valgt, setValgt] = useState(null);
  // Tegning: er "✏️ Tegn" slået til, og hvilket værktøj er valgt?
  const [tegneAktiv, setTegneAktiv] = useState(false);
  const [vaerktoej, setVaerktoej] = useState("fri");
  // Spøgelsesbrikken mens man trækker: { hvad, venstre, top, b, h } – eller null
  const [spoegelse, setSpoegelse] = useState(null);
  // Hvad der er lyst op under fingeren: en rolle ("VB"), "baenk" – eller null
  const [lysOp, setLysOp] = useState(null);

  // Afspilning af systemer (se tavle/Skuffe.jsx)
  const afspilning = useTavleAfspilning(data.systemer);

  /* ---------- REFS (ting vi skal huske, uden at siden tegnes forfra) ----------
     useRef giver en "kasse" (.current), som overlever mellem renderinger.
     At ændre .current får IKKE React til at tegne siden igen – perfekt til trækket. */
  const baneRef = useRef(null);          // banens <div> (til at regne koordinater ud)
  const baenkRef = useRef(null);         // udskifterlisten (til at se, om man slipper der)
  const spoegelseRef = useRef(null);     // spøgelsesbrikkens <div> (flyttes direkte)
  const traekRef = useRef(null);         // det igangværende træk (eller null)
  const sidstSluppetRef = useRef(0);     // tidspunkt for sidste slip på en brik

  // Er den valgte spiller blevet slettet, er der ingen valgt
  const valgtId = valgt !== null && findSpiller(valgt) ? valgt : null;

  /* ---------- AFLEDTE VÆRDIER (regnes ud fra data ved hver rendering) ---------- */
  const paaBaenken = sorteretTrup(data.spillere.filter(s => findPladsFor(data.opstilling, s.id) === null));
  const antalPaaBanen = Object.values(data.opstilling).filter(id => id !== null).length;

  const advarsler = [];
  for (const plads in data.opstilling) {
    const spiller = findSpiller(data.opstilling[plads]);
    if (!spiller) continue;
    if (!passerTilPlads(spiller, plads)) {
      advarsler.push(
        <div key={plads + "-plads"} className="advarsel-linje">
          ⚠️ <b>{spiller.navn}</b> ({ROLLER[spiller.rolle].navn}) står som <b>{ROLLER[plads].navn}</b>
        </div>
      );
    }
    const skade = aktivSkade(spiller);
    if (skade) {
      advarsler.push(
        <div key={plads + "-skade"} className="advarsel-linje">
          🩹 <b>{spiller.navn}</b> er skadet ({skade.type})
        </div>
      );
    }
  }

  /* ---------- body-klassen "drag-i-gang" ----------
     Den gør de tomme pladser tydelige – mens man trækker en spiller, eller når en spiller er valgt.
     body ligger uden for React, så vi sætter klassen i en useEffect (og fjerner den igen bagefter). */
  const spillerTraekkes = spoegelse !== null && spoegelse.hvad.type === "spiller";
  useEffect(() => {
    document.body.classList.toggle("drag-i-gang", valgtId !== null || spillerTraekkes);
    return () => document.body.classList.remove("drag-i-gang");
  }, [valgtId, spillerTraekkes]);

  /* ---------- TRÆK OG SLIP ---------- */

  // Kaldes når man trykker på en brik eller en modstander
  function startTraek(e, hvad) {
    if (e.button !== 0 || tegneAktiv) return;      // kun venstre museknap / én finger, og ikke mens man tegner
    e.stopPropagation();
    const boks = e.currentTarget.getBoundingClientRect();
    traekRef.current = {
      hvad,                                        // { type: "spiller", id } eller { type: "modstander", index }
      startX: e.clientX,
      startY: e.clientY,
      erStartet: false,                            // bliver true, når man har flyttet sig lidt
      // Hvor på brikken man greb fat (så den ikke "hopper", når man slipper)
      greb: { x: e.clientX - (boks.left + boks.width / 2), y: e.clientY - (boks.top + boks.height / 2) },
      stoerrelse: { b: boks.width, h: boks.height },
    };
  }

  // Hvad er under fingeren/musen? En plads, bænken eller bare banen?
  function findMaal(x, y) {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    const plads = el.closest(".plads");
    if (plads && baneRef.current.contains(plads)) return { type: "plads", rolle: plads.dataset.rolle };
    if (baenkRef.current && baenkRef.current.contains(el)) return { type: "baenk" };
    if (baneRef.current.contains(el)) return { type: "bane" };
    return null;
  }

  function flytTraek(e) {
    const t = traekRef.current;
    if (!t) return;
    const venstre = e.clientX - t.greb.x - t.stoerrelse.b / 2;
    const top = e.clientY - t.greb.y - t.stoerrelse.h / 2;

    if (!t.erStartet) {
      // Først når man har flyttet sig mere end 6 pixels, starter selve trækket
      if (Math.hypot(e.clientX - t.startX, e.clientY - t.startY) < 6) return;
      t.erStartet = true;
      setSpoegelse({ hvad: t.hvad, venstre, top, b: t.stoerrelse.b, h: t.stoerrelse.h });
    } else if (spoegelseRef.current) {
      // Spøgelset flyttes DIREKTE i DOM'en – så skal React ikke tegne siden forfra ved hver bevægelse
      spoegelseRef.current.style.left = venstre + "px";
      spoegelseRef.current.style.top = top + "px";
    }
    e.preventDefault();

    // Lys pladsen eller bænken op, hvis man er over den (React gør intet, hvis værdien er den samme)
    if (t.hvad.type === "spiller") {
      const maal = findMaal(e.clientX, e.clientY);
      setLysOp(maal && maal.type === "plads" ? maal.rolle : maal && maal.type === "baenk" ? "baenk" : null);
    }
  }

  function slutTraek(e) {
    const t = traekRef.current;
    if (!t) return;
    traekRef.current = null;
    sidstSluppetRef.current = Date.now();
    setSpoegelse(null);
    setLysOp(null);

    // Et træk der blev afbrudt (fx af et opkald på telefonen), gør ingenting
    if (e.type === "pointercancel") return;
    // Flyttede man sig næsten ikke, var det et tryk
    if (!t.erStartet) {
      if (t.hvad.type === "spiller") haandterTryk(t.hvad.id);
      return;
    }

    const maal = findMaal(e.clientX, e.clientY);
    // Brikkens midte (der hvor brikken står, ikke der hvor fingeren er)
    const punkt = skaermTilTavle(baneRef.current, e.clientX - t.greb.x, e.clientY - t.greb.y);

    if (t.hvad.type === "modstander") {
      if (maal && maal.type !== "baenk") {
        const index = t.hvad.index;
        opdater(d => { d.modstander.positioner[index] = punkt; });
      }
      return;
    }

    // Vores spiller
    const id = t.hvad.id;
    setValgt(null);
    const fraPlads = findPladsFor(data.opstilling, id);
    if (maal && maal.type === "plads" && maal.rolle !== fraPlads) {
      opdater(d => saetPaaPlads(d, id, maal.rolle));        // en anden plads → sæt ham der (bytter hvis optaget)
    } else if (maal && maal.type === "baenk") {
      opdater(d => sendTilPanel(d, id));                    // bænken → ud af banen
    } else if (maal && fraPlads !== null) {
      opdater(d => { d.pladsPositioner[fraPlads] = punkt; });   // frit sted på banen → flyt hans plads derhen
    }
    // ellers: sluppet et sted uden mening → intet sker (bænkspillere kan ikke slippes på et frit sted)
  }

  /*
    TRYK-FOR-AT-FLYTTE (godt på telefon og iPad):
      1. tryk på en spiller → han bliver markeret
      2. tryk på en tom plads → han sættes der
         tryk på en anden spiller → de bytter (bane ↔ bane, eller bane ↔ bænk = udskiftning)
         tryk på bænken → han går ud
         tryk et frit sted på banen → han flytter derhen
      Tryk på den samme spiller igen fjerner markeringen.
  */
  function haandterTryk(id) {
    if (valgtId === null || valgtId === id) {
      setValgt(valgtId === id ? null : id);
      return;
    }
    // Der er allerede valgt en spiller – nu er det et bytte
    const v = valgtId;
    const valgtPlads = findPladsFor(data.opstilling, v);
    const trykketPlads = findPladsFor(data.opstilling, id);
    setValgt(null);
    if (trykketPlads !== null) {
      opdater(d => saetPaaPlads(d, v, trykketPlads));       // den valgte tager den trykkedes plads
    } else if (valgtPlads !== null) {
      opdater(d => saetPaaPlads(d, id, valgtPlads));        // udskiftning: bænkspilleren ind, den valgte ud
    } else {
      setValgt(id);                                         // to bænkspillere → vælg bare den nye
    }
  }

  // Klik på en tom plads, bænken eller banen, mens en spiller er valgt
  function trykPaaTavle(e) {
    if (valgtId === null || tegneAktiv || e.target.closest(".brik, .modstander")) return;
    // Browseren sender et "click" lige efter man har trykket på en brik – det skal ikke tælle
    if (Date.now() - sidstSluppetRef.current < 350) return;
    const maal = findMaal(e.clientX, e.clientY);
    if (!maal) return;
    const id = valgtId;
    setValgt(null);
    const fraPlads = findPladsFor(data.opstilling, id);
    if (maal.type === "plads") {
      opdater(d => saetPaaPlads(d, id, maal.rolle));
    } else if (maal.type === "baenk") {
      opdater(d => sendTilPanel(d, id));
    } else if (fraPlads !== null) {
      const punkt = skaermTilTavle(baneRef.current, e.clientX, e.clientY);
      opdater(d => { d.pladsPositioner[fraPlads] = punkt; });
    }
  }

  /*
    pointermove/pointerup skal lyttes efter på HELE dokumentet (man kan slippe hvor som helst).
    Lytterne sættes på ÉN gang (useEffect med tom liste []) og fjernes, når siden lukkes.
    Problemet: en funktion fra første rendering kender kun de data, der var DENGANG.
    Løsning: vi gemmer de nyeste udgaver af funktionerne i en ref efter hver rendering,
    og lytterne kalder altid den nyeste.
  */
  const senesteRef = useRef(null);
  useEffect(() => {
    senesteRef.current = { flytTraek, slutTraek };
  });
  useEffect(() => {
    const flyt = e => senesteRef.current?.flytTraek(e);
    const slut = e => senesteRef.current?.slutTraek(e);
    // passive: false = vi må kalde preventDefault() (så siden ikke scroller, mens man trækker)
    document.addEventListener("pointermove", flyt, { passive: false });
    document.addEventListener("pointerup", slut);
    document.addEventListener("pointercancel", slut);
    return () => {
      document.removeEventListener("pointermove", flyt);
      document.removeEventListener("pointerup", slut);
      document.removeEventListener("pointercancel", slut);
    };
  }, []);

  /* ---------- KNAPPERNE I PANELET ---------- */

  function skiftForsvar(formation) {
    opdater(d => {
      d.modstander.formation = formation;
      d.modstander.positioner = startPositioner(formation);
    });
  }

  // "↺ Ret op": alle pladser tilbage på standardpositionerne (spillerne bliver på banen)
  function retOp() {
    opdater(d => { d.pladsPositioner = standardPladsPositioner(); });
  }

  // Nulstil: alle spillere på bænken, pladserne og modstanderne tilbage på standardpladserne
  function nulstil() {
    setValgt(null);
    opdater(d => {
      d.opstilling = tomOpstilling();
      d.pladsPositioner = standardPladsPositioner();
      d.modstander.positioner = startPositioner(d.modstander.formation);
    });
  }

  /* ---------- SPØGELSESBRIKKEN ----------
     createPortal tegner den direkte i <body> (uden for siden), ligesom i den gamle udgave,
     så den kan svæve over alt andet. */
  function lavSpoegelse() {
    if (!spoegelse) return null;
    const stil = { left: spoegelse.venstre, top: spoegelse.top, width: spoegelse.b, height: spoegelse.h };
    const { hvad } = spoegelse;
    if (hvad.type === "modstander") {
      return createPortal(
        <div ref={spoegelseRef} className="modstander spoegelse" style={stil}>
          <ModstanderFigur nr={hvad.index} />
        </div>,
        document.body
      );
    }
    const spiller = findSpiller(hvad.id);
    if (!spiller) return null;
    return createPortal(
      <Brik
        ref={spoegelseRef}
        spiller={spiller}
        pladsRolle={findPladsFor(data.opstilling, hvad.id)}
        className="spoegelse"
        style={stil}
      />,
      document.body
    );
  }

  // Bliver denne brik/modstander trukket lige nu?
  const traekkesSpiller = id => spoegelse !== null && spoegelse.hvad.type === "spiller" && spoegelse.hvad.id === id;
  const traekkesModstander = i => spoegelse !== null && spoegelse.hvad.type === "modstander" && spoegelse.hvad.index === i;

  const baneKlasser = "bane" +
    (tegneAktiv ? " tegner" : "") +
    (tegneAktiv && vaerktoej === "visk" ? " visker" : "") +
    (afspilning.system ? " afspiller-aktiv" : "");

  return (
    <main className="side side-tavle">
      {/* ===================== VENSTRE SIDE: BANEN ===================== */}
      <section className="bane-omraade">
        <div ref={baneRef} className={baneKlasser} onClick={trykPaaTavle}>
          <BaneSVG />

          <Tegning aktiv={tegneAktiv} vaerktoej={vaerktoej} setVaerktoej={setVaerktoej} />

          {/* Et system der afspilles på tavlen (styres fra skuffen) */}
          {afspilning.system && (
            <AfspilLag
              system={afspilning.system}
              tid={afspilning.tid}
              trinNavn={afspilning.trinNavn}
              opstilling={data.opstilling}
              spillere={data.spillere}
              pladsPositioner={data.pladsPositioner}
            />
          )}

          {/* De 7 pladser. key={plads.rolle}: hver plads har en fast, unik nøgle */}
          {PLADSER.map(plads => {
            const rolle = plads.rolle;
            const spiller = findSpiller(data.opstilling[rolle]);
            const p = data.pladsPositioner[rolle];
            return (
              <div
                key={rolle}
                className={"plads" + (spiller ? " optaget" : "") + (lysOp === rolle ? " lys-op" : "")}
                data-rolle={rolle}
                title={ROLLER[rolle].navn}
                style={tilProcent(p.x, p.y)}
              >
                <span className="plads-label">{rolle}</span>
                {spiller && (
                  <Brik
                    spiller={spiller}
                    pladsRolle={rolle}
                    valgt={spiller.id === valgtId}
                    flyttes={traekkesSpiller(spiller.id)}
                    onPointerDown={e => startTraek(e, { type: "spiller", id: spiller.id })}
                  />
                )}
              </div>
            );
          })}

          {/* Modstanderne: målmanden (nr. 0) og forsvarsspillerne 1-6 */}
          {data.modstander.positioner.map((pos, index) => (
            <div
              key={index}
              className={"modstander" + (traekkesModstander(index) ? " flyttes" : "")}
              title={index === 0 ? "Modstanderens målmand" : `Forsvarsspiller ${index}`}
              style={tilProcent(pos.x, pos.y)}
              onPointerDown={e => startTraek(e, { type: "modstander", index })}
            >
              <ModstanderFigur nr={index} />
            </div>
          ))}
        </div>
      </section>

      {/* ===================== HØJRE SIDE: PANELET ===================== */}
      <aside className="panel">
        <div className="tavle-vaerktoej">
          <div className="tavle-vaerktoej-raekke">
            <label className="forsvar-valg" title="Modstanderens forsvar">Forsvar
              <select value={data.modstander.formation} onChange={e => skiftForsvar(e.target.value)}>
                <option value="">Intet</option>
                <option value="6-0">6-0</option>
                <option value="5-1">5-1</option>
                <option value="3-2-1">3-2-1</option>
              </select>
            </label>
            <span className="status">På banen: {antalPaaBanen}/7</span>
          </div>
          <div className="tavle-vaerktoej-raekke">
            <button
              className={"knap knap-lille" + (tegneAktiv ? " aktiv-knap" : "")}
              title="Tegn pile og streger på banen"
              onClick={() => setTegneAktiv(!tegneAktiv)}
            >
              {tegneAktiv ? "✓ Færdig" : "✏️ Tegn"}
            </button>
            <button className="knap knap-lille" title="Sæt alle spillere tilbage på standardpladserne" onClick={retOp}>↺ Ret op</button>
            <button className="knap knap-lille knap-fare" title="Tøm banen" onClick={nulstil}>Nulstil</button>
          </div>
        </div>

        {/* Advarslerne står øverst, så man altid kan se dem uden at scrolle */}
        <h2>Advarsler</h2>
        <div className="advarsler">
          {advarsler.length > 0 ? advarsler : <p className="tom-tekst" style={{ margin: 0 }}>Ingen advarsler 👍</p>}
        </div>

        <h2>Udskiftere ({paaBaenken.length})</h2>
        {/* Spillere der ikke er på banen. Man kan også trække spillere herind. */}
        <div
          ref={baenkRef}
          className={"udskiftere" + (lysOp === "baenk" ? " lys-op" : "")}
          onClick={trykPaaTavle}
        >
          {paaBaenken.map(spiller => (
            <Brik
              key={spiller.id}
              spiller={spiller}
              pladsRolle={null}
              valgt={spiller.id === valgtId}
              flyttes={traekkesSpiller(spiller.id)}
              onPointerDown={e => startTraek(e, { type: "spiller", id: spiller.id })}
            />
          ))}
          {paaBaenken.length === 0 && (
            <p className="tom-tekst">Alle spillere er på banen.<br />Træk en spiller herind for at tage ham ud.</p>
          )}
        </div>

        <Opstillinger />

        <h2>Roller</h2>
        <div className="forklaring">
          {Object.keys(ROLLER).map(kode => (
            <div key={kode} className="forklaring-punkt">
              <span className="farve-prik" style={{ background: ROLLER[kode].farve }}></span>
              {kode} – {ROLLER[kode].navn}
            </div>
          ))}
          <div className="forklaring-punkt">
            <span className="farve-prik" style={{ background: MODSTANDER_FARVE, borderColor: MODSTANDER_KANT }}></span>
            Modstander
          </div>
          <div className="forklaring-punkt">
            <span className="farve-prik" style={{ background: HJEMME.mark.farve }}></span>
            Vores trøjer (MV: grå)
          </div>
        </div>
      </aside>

      {/* ========== SKUFFEN: afspil systemer på tavlen ========== */}
      <Skuffe systemer={data.systemer} afspilning={afspilning} />

      {lavSpoegelse()}
    </main>
  );
}
