/*
  SIDE 5: KAMPDAG – live registrering under en kamp.

  Øverst:   måltavlen (vores score – kampuret – modstanderens score)
  Venstre:  vores spillere med knapper (mål, assist, afbrænder, teknisk fejl, 2 min)
  Højre:    aktive udvisninger, hændelsesloggen og "Afslut kamp og gem"

  Alt om kampen ligger i data.kampdag (se nyKampdag() i standardData.js), så
  kampen overlever, at man skifter fane eller genindlæser siden.

  KAMPURET
  I stedet for at tælle sekunder med en timer (som kan gå skævt), husker vi
  HVORNÅR uret blev startet. Kamptiden = gemte sekunder + tiden siden start.
  En setInterval tegner bare siden forfra 4 gange i sekundet, så uret "går".

  NYT: MÅLMANDSREDNINGER, SKUDKORT OG SPILLETID
  - Målmænd (rolle MV) har en ekstra knap "🧤 Redning". Redningsprocenten er
      redninger / (redninger + modstanderens mål)
  - Efter "⚽ Mål", "❌ Afbrænder" og "⚽ Mål til dem" spørger en lille boks,
    hvor i målet skuddet gik (3 × 3 felter). Svaret gemmes på hændelsen som
    "hjoerne" – og skudkortet regnes ud fra hændelserne. Derfor virker
    "Fortryd" automatisk: fjernes hændelsen, forsvinder skuddet også fra kortet.
  - "På banen" (🟢-knappen): spilletiden måles i KAMPTID, ligesom uret.
    Vi husker kun, hvornår (i kamptid) spilleren kom på banen. Kamptiden står
    stille, når uret er stoppet – så tæller spilletiden heller ikke. Vi skriver
    altså kun til data, når man trykker på knappen (ikke hvert sekund).

  Nye felter i data.kampdag (gamle gemte kampe har dem ikke – derfor "?? {}"):
    paaBanen: { spillerId: { sek, fra } }   sek = spilletid før, fra = kamptid da spilleren kom ind (null = på bænken)
    aktivMaalmandId                         hvem står "🧤 I mål" (mangler i gamle data → første MV der er med)
    stats[spillerId].redninger              antal redninger
    haendelser: { ..., hjoerne: "hoej-venstre", maalmandId }   (maalmandId på "Mål til dem")
*/
import { useEffect, useRef, useState } from "react";
import { useData } from "../DataKontekst.jsx";
import { useDialog } from "../komponenter/Dialog.jsx";
import { HJEMME, KAMP_HANDLINGER } from "../data/konstanter.js";
import { nyKampdag } from "../data/standardData.js";
import { aktivSkade, formatUr, idagISO, nytId, sorteretTrup } from "../hjaelpere.js";
import { HjoerneVaelger, MaalGitter } from "./kampdag/MaalGitter.jsx";
import { HJOERNE_NOEGLER, harSkudData, hjoerneNavn } from "./kampdag/maalHjoerner.js";
import LiveForslag from "./analyse/LiveForslag.jsx";
import { IMOD_NAVN, imodFordeling } from "./analyse/live.js";
import "./Kampdag.css";

// Målmandens ekstra knap. Ligger her (ikke i konstanter.js), og lægges sammen med de andre knapper.
const REDNING = { ikon: "🧤", navn: "Redning", felt: "redninger" };
const HANDLINGER = { ...KAMP_HANDLINGER, redning: REDNING };

// Hændelser hvor vi spørger "hvor i målet?"
const SKUD_TYPER = ["maal", "afb"];

/* =========================================================
   HJÆLPEFUNKTIONER (uden for komponenten – de ændrer ikke noget)
   ========================================================= */

// Kamptiden i sekunder. "nu" er tidspunktet vi regner ud fra (Date.now()).
function kamptid(k, nu) {
  const ekstra = k.koerer ? Math.max(0, (nu - k.startetVed) / 1000) : 0;
  return k.sekunder + ekstra;
}

// Hvornår slutter den halvleg vi er i? (1. halvleg: 30:00, 2. halvleg: 60:00)
function halvlegSlut(k) {
  return k.halvleg * k.halvlegMin * 60;
}

// Kamptiden, men aldrig forbi halvlegens slutfløjt
// (uret kan nå at løbe en brøkdel af et sekund over, før det bliver stoppet)
function kamptidKlemt(k, nu) {
  return Math.min(kamptid(k, nu), halvlegSlut(k));
}

// En spillers tal i kampen – til VISNING (laver ikke noget nyt i data).
// {...NUL_STATS, ...} fylder felter ud, som gamle gemte kampe ikke har (fx redninger).
const NUL_STATS = { maal: 0, assists: 0, afbraendere: 0, tekniskeFejl: 0, udvisninger: 0, redninger: 0 };
function statsAf(k, spillerId) {
  return { ...NUL_STATS, ...k.stats[spillerId] };
}

/* ---------- Spilletid ---------- */
// Er spilleren markeret "på banen" lige nu?
function erPaaBanen(k, spillerId) {
  const p = (k.paaBanen ?? {})[spillerId];
  return Boolean(p) && p.fra != null;
}

// Spilletid i sekunder: gemt tid + tiden siden spilleren kom ind (målt i kamptid)
function spilletid(k, spillerId, tid) {
  const p = (k.paaBanen ?? {})[spillerId];
  if (!p) return 0;
  return (Number(p.sek) || 0) + (p.fra != null ? Math.max(0, tid - p.fra) : 0);
}

// Sæt en spiller på banen / på bænken (bruges kun inde i opdater på kopien)
function saetPaaBanen(k, spillerId, paa, tid) {
  if (!k.paaBanen) k.paaBanen = {};
  const p = k.paaBanen[spillerId] || { sek: 0, fra: null };
  if (paa && p.fra == null) p.fra = tid;
  if (!paa && p.fra != null) {
    p.sek = (Number(p.sek) || 0) + Math.max(0, tid - p.fra);
    p.fra = null;
  }
  k.paaBanen[spillerId] = p;
}

/* ---------- Skudkort ---------- */
// Lav et skudkort { "hoej-venstre": { maal, afb }, ... } ud fra hændelserne.
// "passer" vælger hvilke hændelser der tæller med (fx kun én spillers skud).
function skudKortAf(haendelser, passer) {
  const kort = {};
  for (const h of haendelser) {
    if (!h.hjoerne || !HJOERNE_NOEGLER.includes(h.hjoerne) || !passer(h)) continue;
    if (!kort[h.hjoerne]) kort[h.hjoerne] = { maal: 0, afb: 0 };
    if (h.type === "afb") kort[h.hjoerne].afb++;
    else kort[h.hjoerne].maal++;            // "maal" (vores) og "modmaal" (deres) tæller som mål
  }
  return kort;
}
const voresSkud = h => SKUD_TYPER.includes(h.type);
const deresMaal = h => h.type === "modmaal";

/* ---------- Målmænd ---------- */
/*
  "🧤 I mål": træneren vælger selv, hvem der står i mål (k.aktivMaalmandId).
  Gamle gemte kampe har ikke feltet – så bruger vi den første målmand (MV), der er med.
  Er den valgte spiller slettet eller ikke med længere, falder vi også tilbage.
*/
function aktivMaalmandId(k, spillere) {
  const valgt = spillere.find(s => s.id === k.aktivMaalmandId);
  if (valgt && erMed(k, valgt)) return valgt.id;
  const foerste = sorteretTrup(spillere).find(s => s.rolle === "MV" && erMed(k, s));
  return foerste ? foerste.id : null;
}

/*
  Redningsprocent for en målmand = hans redninger / (hans redninger + mål imod HAM).
  Mål imod: hvert "Mål til dem" får id'et på den målmand, der stod i mål (maalmandId).
  Gamle hændelser UDEN maalmandId tæller kun med, hvis der var præcis én målmand
  med i kampen – ellers ved vi ikke hvem, og så springer vi dem over i procenten.
*/
function maalmandTal(k, spillerId, spillere) {
  const redninger = statsAf(k, spillerId).redninger;
  const modmaal = k.haendelser.filter(h => h.type === "modmaal");
  const mine = modmaal.filter(h => h.maalmandId === spillerId).length;
  const maalmaend = spillere.filter(s => s.rolle === "MV" && erMed(k, s));
  const eneste = maalmaend.length === 1 && maalmaend[0].id === spillerId;
  const gamle = eneste ? modmaal.filter(h => h.maalmandId == null).length : 0;
  const maalImod = mine + gamle;
  const skud = redninger + maalImod;
  return { redninger, maalImod, procent: skud ? Math.round((redninger / skud) * 100) : null };
}

// De 3 felter hvor modstanderen har scoret mest – til teksten når kampen afsluttes
function topHjoerner(kort) {
  return HJOERNE_NOEGLER
    .filter(n => kort[n]?.maal)
    .sort((a, b) => kort[b].maal - kort[a].maal)
    .slice(0, 3)
    .map(n => `${hjoerneNavn(n)} (${kort[n].maal})`)
    .join(", ");
}

// En spillers tal – til at RETTE i (bruges kun inde i opdater på kopien)
function statsTilRetning(k, spillerId) {
  if (!k.stats[spillerId]) k.stats[spillerId] = { ...NUL_STATS };
  return k.stats[spillerId];
}

// Er spilleren med i kampen? Hvis man ikke har valgt, er alle der ikke er skadet, med.
function erMed(k, spiller) {
  return spiller.id in k.med ? k.med[spiller.id] : !aktivSkade(spiller);
}

// Læg en hændelse i loggen (bruges kun inde i opdater på kopien)
function tilfoejHaendelse(k, nu, h) {
  k.haendelser.push({ id: nu + Math.random(), sek: Math.floor(kamptid(k, nu)), ...h });
}

/* =========================================================
   KOMPONENTEN
   ========================================================= */
export default function Kampdag() {
  const { data, opdater } = useData();
  const { spoerg, bekraeftSlet } = useDialog();
  const kampdag = data.kampdag;
  const modstanderFelt = useRef(null);

  // Boksen "Hvor i målet?": { haendelseId, titel } – eller null når den er lukket
  const [hjoerneSpoerg, setHjoerneSpoerg] = useState(null);
  // Skudkortet til højre: "vores" skud eller "imod" (modstanderens mål)
  const [skudVisning, setSkudVisning] = useState("vores");
  // "Vis alle" i "🧤 I mål"-vælgeren: så kan man også sætte en markspiller i mål
  const [visAlleIMaal, setVisAlleIMaal] = useState(false);

  // "nu" = tidspunktet siden sidst blev tegnet. Intervallet nedenfor sætter det
  // 4 gange i sekundet – og fordi det er state, tegner React siden forfra hver gang.
  const [nu, setNu] = useState(() => Date.now());

  // useEffect med setInterval: start et "ur" når siden vises ...
  useEffect(() => {
    const interval = setInterval(() => setNu(Date.now()), 250);
    // ... og STOP det igen, når siden forsvinder (cleanup). Ellers ville
    // intervallet blive ved med at køre i baggrunden, selvom siden er væk.
    return () => clearInterval(interval);
  }, []);

  /*
    Efter hver tegning: er halvlegen slut, eller er en udvisning udløbet?
    Kun DÅ skriver vi til data (ikke hvert kvarte sekund).
    Inde i opdater tjekker vi igen på den friske kopi, så det aldrig sker to gange.
  */
  useEffect(() => {
    const tid = kamptid(kampdag, Date.now());
    const halvlegErSlut = kampdag.koerer && tid >= halvlegSlut(kampdag);
    const udloebet = kampdag.udvisninger.some(u => u.slutSek <= tid);
    if (!halvlegErSlut && !udloebet) return;

    opdater(d => {
      const k = d.kampdag;
      const tidNu = Date.now();
      // Halvlegen er slut → stop uret ved præcis 30:00 / 60:00
      if (k.koerer && kamptid(k, tidNu) >= halvlegSlut(k)) {
        k.sekunder = halvlegSlut(k);
        k.koerer = false;
        tilfoejHaendelse(k, tidNu, { type: "info", tekst: k.halvleg === 1 ? "🔔 Halvleg" : "🔔 Slutfløjt" });
      }
      // Udvisninger der er udløbet, fjernes (de tæller kun, mens uret går – ligesom i en rigtig kamp)
      const t = kamptid(k, tidNu);
      k.udvisninger = k.udvisninger.filter(u => u.slutSek > t);
    });
  }, [nu, kampdag, opdater]);

  // Kamptiden lige nu (til visning)
  const tid = kamptid(kampdag, nu);

  /* ---------- Uret ---------- */
  function startStopUr() {
    const tidNu = Date.now();
    opdater(d => {
      const k = d.kampdag;
      if (k.koerer) {
        k.sekunder = kamptid(k, tidNu);   // gem tiden der er gået
        k.koerer = false;
      } else {
        // Er halvlegen slut, kan uret ikke startes – man skal trykke "2. halvleg"
        if (k.sekunder >= halvlegSlut(k)) return;
        k.startetVed = tidNu;
        k.koerer = true;
      }
    });
  }

  function startAndenHalvleg() {
    const tidNu = Date.now();
    opdater(d => {
      const k = d.kampdag;
      if (k.halvleg === 2) return;
      const foer = kamptid(k, tidNu);
      k.sekunder = Math.max(foer, k.halvlegMin * 60);   // 2. halvleg starter ved fx 30:00
      // Hopper uret frem, skal aktive udvisninger flyttes lige så meget (resten afsones i 2. halvleg)
      const hop = k.sekunder - foer;
      k.udvisninger.forEach(u => { u.slutSek += hop; });
      // Det samme med spilletiden: hoppet må ikke tælle som tid på banen
      Object.values(k.paaBanen ?? {}).forEach(p => { if (p.fra != null) p.fra += hop; });
      k.koerer = false;
      k.halvleg = 2;
      tilfoejHaendelse(k, tidNu, { type: "info", tekst: "▶ 2. halvleg" });
    });
  }

  /* ---------- Registrering ---------- */
  // Tryk på en knap ved en spiller (mål, assist, afbrænder, teknisk fejl, 2 min, redning)
  function registrer(spillerId, type) {
    const tidNu = Date.now();
    const udvId = nytId();
    // Hændelsens id laves HER (ikke inde i opdater), så vi kan finde den igen fra "Hvor i målet?"-boksen
    const haendelseId = tidNu + Math.random();
    opdater(d => {
      const k = d.kampdag;
      const st = statsTilRetning(k, spillerId);
      const felt = HANDLINGER[type].felt;
      st[felt] = (st[felt] || 0) + 1;      // "|| 0": gamle data har måske ikke feltet (fx redninger)
      const haendelse = { id: haendelseId, type, spillerId };
      if (type === "maal") k.hjemme++;
      if (type === "udv") {
        haendelse.udvId = udvId;
        k.udvisninger.push({ id: udvId, spillerId, slutSek: kamptid(k, tidNu) + 120 });   // 2 min = 120 sek
      }
      tilfoejHaendelse(k, tidNu, haendelse);
    });
    // Mål eller afbrænder → spørg hvor i målet skuddet gik (man kan springe over)
    if (SKUD_TYPER.includes(type)) {
      const spiller = data.spillere.find(s => s.id === spillerId);
      const h = HANDLINGER[type];
      setHjoerneSpoerg({ haendelseId, titel: `${h.ikon} ${h.navn} – #${spiller?.nummer ?? "?"} ${spiller?.navn ?? ""}` });
    }
  }

  function modstanderMaal() {
    const tidNu = Date.now();
    const haendelseId = tidNu + Math.random();
    opdater(d => {
      const k = d.kampdag;
      k.ude++;
      const haendelse = { id: haendelseId, type: "modmaal" };
      // Målet skrives på den målmand, der står "🧤 I mål" lige nu (til redningsprocenten)
      const mv = aktivMaalmandId(k, d.spillere);
      if (mv != null) haendelse.maalmandId = mv;
      tilfoejHaendelse(k, tidNu, haendelse);
    });
    setHjoerneSpoerg({ haendelseId, imod: true, titel: `⚽ Mål til ${kampdag.modstander || "modstanderen"}` });
  }

  // "🧤 I mål:"-vælgeren: skift målmand. Gælder kun hændelser, der kommer EFTER skiftet.
  function skiftMaalmand(id) {
    const tidNu = Date.now();
    opdater(d => {
      const k = d.kampdag;
      if (k.aktivMaalmandId === id) return;
      k.aktivMaalmandId = id;
      const s = d.spillere.find(x => x.id === id);
      if (s) tilfoejHaendelse(k, tidNu, { type: "info", tekst: `🧤 ${s.navn} i mål` });
    });
  }

  // Svar fra "Hvor i målet?"-boksen: skriv hjørnet på hændelsen
  // skytte: deres position (kun ved "Mål til dem") – bruges af live-forslagene
  function vaelgHjoerne(noegle, skytte = null) {
    const id = hjoerneSpoerg?.haendelseId;
    setHjoerneSpoerg(null);
    if (!noegle && !skytte) return;
    opdater(d => {
      const h = d.kampdag.haendelser.find(x => x.id === id);
      if (!h) return;                      // er hændelsen fortrudt imens, sker der ingenting
      if (noegle) h.hjoerne = noegle;
      if (skytte) h.skytte = skytte;
    });
  }

  // "🟢 På banen"-knappen
  function skiftPaaBanen(spillerId) {
    const tidNu = Date.now();
    opdater(d => {
      const k = d.kampdag;
      saetPaaBanen(k, spillerId, !erPaaBanen(k, spillerId), kamptidKlemt(k, tidNu));
    });
  }

  // −1-knapperne retter kun stillingen (fx hvis man har trykket forkert uden at bruge Fortryd)
  function traekFra(felt) {
    opdater(d => { d.kampdag[felt] = Math.max(0, d.kampdag[felt] - 1); });
  }

  // "↶ Fortryd seneste": fjern den sidste hændelse og rul dens effekt tilbage
  function fortrydHaendelse() {
    opdater(d => {
      const k = d.kampdag;
      // Find den seneste hændelse man selv har registreret (spring "🔔 Halvleg" o.l. over)
      let index = k.haendelser.length - 1;
      while (index >= 0 && k.haendelser[index].type === "info") index--;
      if (index < 0) return;
      const [h] = k.haendelser.splice(index, 1);   // tag den ud af listen

      if (HANDLINGER[h.type]) {
        const st = statsTilRetning(k, h.spillerId);
        const felt = HANDLINGER[h.type].felt;
        st[felt] = Math.max(0, (st[felt] || 0) - 1);
      }
      // Skudkortet og "mål imod målmanden" regnes ud fra hændelserne,
      // så de er allerede rettet, nu hvor hændelsen er væk.
      if (h.type === "maal") k.hjemme = Math.max(0, k.hjemme - 1);
      if (h.type === "modmaal") k.ude = Math.max(0, k.ude - 1);
      if (h.type === "udv") k.udvisninger = k.udvisninger.filter(u => u.id !== h.udvId);
    });
  }

  /* ---------- Afslut / ny kamp ---------- */
  // "🏁 Afslut kamp og gem": skriv tallene ind i hver spillers historik
  async function afslutKamp() {
    const navn = kampdag.modstander.trim();
    if (!navn) {
      await spoerg("Mangler modstander", "Skriv hvem I spiller mod, før kampen gemmes.", [{ tekst: "OK", svar: true }]);
      modstanderFelt.current?.focus();
      return;
    }
    const medIds = data.spillere.filter(s => erMed(kampdag, s)).map(s => s.id);

    // Ekstra linjer i opsummeringen: målmændenes redninger og hvor modstanderen scorede
    const linjer = [];
    for (const s of data.spillere) {
      if (!medIds.includes(s.id)) continue;
      const mt = maalmandTal(kampdag, s.id, data.spillere);
      if (mt.redninger > 0) linjer.push(`🧤 ${s.navn}: ${mt.redninger} redninger (${mt.procent}%)`);
    }
    const imodTop = topHjoerner(skudKortAf(kampdag.haendelser, deresMaal));
    if (imodTop) linjer.push(`🎯 ${navn} scorede mest i: ${imodTop}`);

    const svar = await spoerg("Afslut kamp?",
      `Vores hold ${kampdag.hjemme} – ${kampdag.ude} ${navn}\n\n` +
      (linjer.length ? linjer.join("\n") + "\n\n" : "") +
      `${medIds.length} spillere får kampen skrevet ind i deres historik.`, [
        { tekst: "Annuller", svar: false },
        { tekst: "🏁 Ja, gem kampen", svar: true, stil: "knap-primaer" },
      ]);
    if (svar !== true) return;

    const tidNu = Date.now();
    opdater(d => {
      const k = d.kampdag;   // de FRISKE data (der kan være sket noget, mens boksen var åben)
      const tidSlut = kamptidKlemt(k, tidNu);
      // Har man brugt "på banen" i denne kamp? Ellers gemmer vi ingen spilletid (0 ville være forkert)
      const spilletidBrugt = Object.keys(k.paaBanen ?? {}).length > 0;
      for (const spiller of d.spillere) {
        if (!medIds.includes(spiller.id)) continue;
        const st = statsAf(k, spiller.id);
        const kamp = {
          id: tidNu + spiller.id,
          dato: k.dato || idagISO(),          // tomt datofelt → dagens dato
          modstander: k.modstander.trim() || navn,
          maal: st.maal,
          assists: st.assists,
          afbraendere: st.afbraendere,
          tekniskeFejl: st.tekniskeFejl,
        };
        const sek = Math.round(spilletid(k, spiller.id, tidSlut));
        if (spilletidBrugt) kamp.spilletidSek = sek;

        // Skudkort for spillerens egne skud (kun hvis der er registreret hjørner)
        const kort = skudKortAf(k.haendelser, h => voresSkud(h) && h.spillerId === spiller.id);
        if (harSkudData(kort)) kamp.skudKort = kort;

        // Målmand: gem redninger + mål imod – men kun hvis han faktisk har stået i mål
        // (også en markspiller, der er sat "🧤 I mål" og har redninger/mål imod)
        const mt = maalmandTal(k, spiller.id, d.spillere);
        const harStaaetIMaal = mt.redninger > 0 || mt.maalImod > 0;
        if (harStaaetIMaal || (spiller.rolle === "MV" && sek > 0)) {
          kamp.redninger = mt.redninger;
          kamp.maalImod = mt.maalImod;
        }
        spiller.kampe.push(kamp);
      }
      // Holdets resultat (vises under 📊 Statistik → Holdets resultater).
      // Dato og modstander skrives ens med spillernes kampe, så Statistik kan se, at det er samme kamp.
      if (!Array.isArray(d.kampResultater)) d.kampResultater = [];
      d.kampResultater.push({
        id: tidNu,
        dato: k.dato || idagISO(),
        modstander: k.modstander.trim() || navn,
        hjemme: k.hjemme,
        ude: k.ude,
        // Hvorfra scorede de? { VB: 3, ST: 2, ... } – kun hvis man har valgt det
        imodPladser: imodFordeling(k.haendelser),
      });
      d.kampdag = nyKampdag();
    });
    await spoerg("Kampen er gemt ✓",
      "Tallene kan ses under Spillere → Historik og under Oversigt → Vores kampe mod dem.",
      [{ tekst: "OK", svar: true, stil: "knap-primaer" }]);
  }

  async function nyKamp() {
    if (kampdag.haendelser.length > 0) {
      const ok = await bekraeftSlet("Start en ny kamp?",
        "Alt der er registreret i den nuværende kamp forsvinder (det er ikke gemt i historikken).");
      if (!ok) return;
    }
    opdater(d => { d.kampdag = nyKampdag(); });
  }

  /* ---------- Hjælpere til visningen ---------- */
  const findSpiller = id => data.spillere.find(s => s.id === id);

  // Teksten til en hændelse i loggen (React escaper selv teksten – ingen rens() nødvendig)
  function haendelseTekst(h) {
    if (h.type === "info") return h.tekst;
    // Hvor i målet? (står kun på skud, hvor man har valgt et felt)
    const hjoerne = h.hjoerne ? ` → ${hjoerneNavn(h.hjoerne)}` : "";
    if (h.type === "modmaal") return `⚽ Mål til ${kampdag.modstander || "modstanderen"}${h.skytte ? ` (${IMOD_NAVN[h.skytte]})` : ""}${hjoerne}`;
    const spiller = findSpiller(h.spillerId);
    const handling = HANDLINGER[h.type];
    if (!handling) return "";
    return `${handling.ikon} ${handling.navn} – ${spiller ? `#${spiller.nummer} ${spiller.navn}` : "(slettet spiller)"}${hjoerne}`;
  }

  // Hvem står i mål lige nu, og hvem kan vælges? (MV-spillere – eller alle, hvis "Vis alle" er slået til)
  const iMaalId = aktivMaalmandId(kampdag, data.spillere);
  const iMaal = findSpiller(iMaalId);
  const maalmandValg = sorteretTrup(data.spillere)
    .filter(s => erMed(kampdag, s) && (visAlleIMaal || s.rolle === "MV" || s.id === iMaalId));

  const kanFortryde =kampdag.haendelser.some(h => h.type !== "info");

  // Skudkortet til højre – regnes ud fra hændelserne hver gang siden tegnes
  const skudKort = skudVisning === "imod"
    ? skudKortAf(kampdag.haendelser, deresMaal)
    : skudKortAf(kampdag.haendelser, voresSkud);
  const antalMedHjoerne = HJOERNE_NOEGLER.reduce((sum, n) => sum + (skudKort[n] ? skudKort[n].maal + skudKort[n].afb : 0), 0);

  return (
    <main className="side side-kampdag">

      {/* Måltavlen øverst: vores score – uret – modstanderens score */}
      <div className="maaltavle">
        <div className="hold-score">
          <div className="hold-navn">Vores hold</div>
          <div className="score hjemme">{kampdag.hjemme}</div>
          <div className="score-knapper">
            <button className="knap knap-lille" title="Ret stillingen: træk et mål fra" onClick={() => traekFra("hjemme")}>−1</button>
          </div>
        </div>

        <div className="ur-boks">
          <div className="kamp-info">
            <input
              type="date"
              className="lille-input"
              title="Kampens dato"
              value={kampdag.dato}
              onChange={e => { const v = e.target.value; opdater(d => { d.kampdag.dato = v; }); }}
              // Tømmer man datofeltet, bruger vi dagens dato, når man forlader feltet (en kamp skal have en dato)
              onBlur={e => { if (!e.target.value) opdater(d => { d.kampdag.dato = idagISO(); }); }}
            />
            <select
              className="lille-valg"
              title="Hvor lang er en halvleg?"
              value={kampdag.halvlegMin}
              onChange={e => { const v = Number(e.target.value); opdater(d => { d.kampdag.halvlegMin = v; }); }}
            >
              <option value={20}>2 × 20 min</option>
              <option value={25}>2 × 25 min</option>
              <option value={30}>2 × 30 min</option>
            </select>
          </div>
          <div className="halvleg">{kampdag.halvleg}. halvleg</div>
          <div className={"ur" + (kampdag.koerer ? "" : " pause")}>{formatUr(tid)}</div>
          <div className="ur-knapper">
            <button className="knap knap-primaer" onClick={startStopUr}>
              {kampdag.koerer ? "⏸ Stop ur" : "▶ Start ur"}
            </button>
            <button className="knap" onClick={startAndenHalvleg} disabled={kampdag.halvleg === 2}>2. halvleg ▶</button>
          </div>
        </div>

        <div className="hold-score">
          <input
            ref={modstanderFelt}
            type="text"
            className="modstander-input"
            list="kampdag-forslag"
            maxLength={40}
            placeholder="Modstander"
            value={kampdag.modstander}
            onChange={e => { const v = e.target.value; opdater(d => { d.kampdag.modstander = v; }); }}
          />
          {/* Forslag til modstanderens navn: holdene fra Oversigt */}
          <datalist id="kampdag-forslag">
            {data.modstandere.map(h => <option key={h.id} value={h.navn} />)}
          </datalist>
          <div className="score">{kampdag.ude}</div>
          <div className="score-knapper">
            <button className="knap knap-lille" title="Ret stillingen: træk et mål fra" onClick={() => traekFra("ude")}>−1</button>
            <button className="knap knap-fare knap-lille" onClick={modstanderMaal}>⚽ Mål til dem</button>
          </div>
        </div>
      </div>

      {/* Hvem står i mål? Mål til dem og redninger skrives på denne spiller */}
      <div className="kd-i-maal">
        <label>
          <b>🧤 I mål:</b>{" "}
          <select
            className="lille-valg"
            value={iMaalId ?? ""}
            // <select> giver altid en tekst – find spilleren, så id'et beholder sin rigtige type
            onChange={e => { const s = data.spillere.find(x => String(x.id) === e.target.value); if (s) skiftMaalmand(s.id); }}
          >
            {iMaalId == null && <option value="">– vælg målmand –</option>}
            {maalmandValg.map(s => (
              <option key={s.id} value={s.id}>#{s.nummer} {s.navn}{s.rolle !== "MV" ? ` (${s.rolle})` : ""}</option>
            ))}
          </select>
        </label>
        <label className="kd-vis-alle">
          <input type="checkbox" checked={visAlleIMaal} onChange={e => setVisAlleIMaal(e.target.checked)} /> Vis alle
        </label>
        <button className="knap knap-lille redning-knap" disabled={iMaalId == null} onClick={() => registrer(iMaalId, "redning")}>
          {REDNING.ikon} {REDNING.navn}
        </button>
        {iMaal && (() => {
          const mt = maalmandTal(kampdag, iMaal.id, data.spillere);
          return <span className="kd-redning-info">{mt.redninger} redn. · {mt.maalImod} mål imod{mt.procent !== null ? ` (${mt.procent}%)` : ""}</span>;
        })()}
      </div>

      <div className="kampdag-gitter">
        {/* Venstre: vores spillere med knapper */}
        <section className="kort">
          <div className="liste-top">
            <div>
              <h2>Vores spillere</h2>
              <p className="opsummering">Tryk på knapperne, når der sker noget. Fjern fluebenet ved spillere, der ikke er med.</p>
            </div>
          </div>
          <div>
            {sorteretTrup(data.spillere).map(spiller => {
              const med = erMed(kampdag, spiller);
              const st = statsAf(kampdag, spiller.id);
              const udvisning = kampdag.udvisninger.find(u => u.spillerId === spiller.id);
              const erMaalmand = spiller.rolle === "MV";
              const troeje = erMaalmand ? HJEMME.maalmand : HJEMME.mark;
              const paaBanen = erPaaBanen(kampdag, spiller.id);
              const spillet = spilletid(kampdag, spiller.id, Math.min(tid, halvlegSlut(kampdag)));
              const erIMaal = spiller.id === iMaalId;
              const mt = erMaalmand || erIMaal ? maalmandTal(kampdag, spiller.id, data.spillere) : null;
              return (
                // key: spillerens id, så React kan genkende rækken fra gang til gang
                <div key={spiller.id} className={"kd-spiller" + (med ? "" : " ikke-med") + (udvisning ? " udvist" : "") + (paaBanen ? " paa-banen" : "")}>
                  <label className="kd-med" title="Er med i kampen">
                    <input
                      type="checkbox"
                      checked={med}
                      onChange={e => {
                        const v = e.target.checked;
                        const tidNu = Date.now();
                        opdater(d => {
                          const k = d.kampdag;
                          k.med[spiller.id] = v;
                          // Er spilleren ikke med længere, kan han heller ikke stå på banen
                          if (!v) saetPaaBanen(k, spiller.id, false, kamptidKlemt(k, tidNu));
                        });
                      }}
                    />
                  </label>
                  <span className="mini-nummer" style={{ background: troeje.farve, color: troeje.tekst }}>{spiller.nummer}</span>
                  {/* På banen / på bænken. Spilletiden tæller kun, når spilleren er på banen OG uret går */}
                  <button
                    type="button"
                    className={"kd-paa-banen" + (paaBanen ? " aktiv" : "")}
                    aria-pressed={paaBanen}
                    disabled={!med}
                    title={paaBanen ? "På banen – tryk for at sætte på bænken" : "På bænken – tryk for at sætte på banen"}
                    onClick={() => skiftPaaBanen(spiller.id)}
                  >
                    {paaBanen ? "🟢" : "⚪"} {formatUr(spillet)}
                  </button>
                  <div className="kd-navn">
                    <b>{spiller.navn}</b>
                    {udvisning && <span className="udv-badge">{formatUr(udvisning.slutSek - tid)}</span>}
                    <small>
                      {spiller.rolle} · {st.maal} mål · {st.assists} ass. · {st.afbraendere} afb. · {st.tekniskeFejl} TF
                      {mt && (
                        <span className="kd-redning-info">
                          {" "}· 🧤 {mt.redninger} redn.{mt.procent !== null ? ` (${mt.procent}%)` : ""}
                        </span>
                      )}
                    </small>
                  </div>
                  <div className="kd-knapper">
                    {Object.entries(KAMP_HANDLINGER).map(([type, h]) => (
                      <button key={type} disabled={!med} onClick={() => registrer(spiller.id, type)}>
                        {h.ikon} {h.navn}
                      </button>
                    ))}
                    {/* Redning-knappen står kun ved den, der er "🧤 I mål" – så kan man ikke ramme forkert */}
                    {erIMaal && (
                      <button className="redning-knap" disabled={!med} onClick={() => registrer(spiller.id, "redning")}>
                        {REDNING.ikon} {REDNING.navn}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Højre: udvisninger, hændelser og afslut */}
        <section className="kort kampdag-hoejre">
          <h3>⏱ Udvisninger</h3>
          <div>
            {kampdag.udvisninger.length === 0 ? (
              <p className="tom-tekst" style={{ margin: 0, textAlign: "left" }}>Ingen aktive udvisninger.</p>
            ) : kampdag.udvisninger.map(u => {
              const s = findSpiller(u.spillerId);
              return (
                <div className="udv" key={u.id}>
                  <b>#{s ? s.nummer : "?"} {s ? s.navn : ""}</b>
                  <span className="udv-tid">{formatUr(u.slutSek - tid)}</span>
                </div>
              );
            })}
          </div>

          <h3>💡 Live-forslag</h3>
          <LiveForslag kampdag={kampdag} kompakt />

          <h3>🎯 Skudkort</h3>
          <div className="skudkort-faner">
            <button type="button" className={skudVisning === "vores" ? "aktiv" : ""} onClick={() => setSkudVisning("vores")}>Vores skud</button>
            <button type="button" className={skudVisning === "imod" ? "aktiv" : ""} onClick={() => setSkudVisning("imod")}>Mål imod os</button>
          </div>
          <MaalGitter kort={skudKort} imod={skudVisning === "imod"} />
          <p className="skudkort-note">
            {antalMedHjoerne === 0
              ? "Ingen skud med hjørne endnu. Vælg et felt efter et mål eller en afbrænder."
              : skudVisning === "imod"
                ? `${antalMedHjoerne} mål imod med hjørne – set fra skytten (målmandens svage hjørner).`
                : `${antalMedHjoerne} skud med hjørne – set fra skytten. Grøn = mål, rød = afbrændere.`}
          </p>

          <h3>📜 Hændelser</h3>
          <div>
            <button className="knap knap-lille" onClick={fortrydHaendelse} disabled={!kanFortryde}>↶ Fortryd seneste</button>
          </div>
          <div className="haendelse-liste">
            {kampdag.haendelser.length === 0 ? (
              <p className="tom-tekst">Ingen hændelser endnu.</p>
            ) : [...kampdag.haendelser].reverse().map(h => (   // nyeste øverst
              <div className="haendelse" key={h.id}>
                <span className="tid">{formatUr(h.sek)}</span>{haendelseTekst(h)}
              </div>
            ))}
          </div>

          <div className="kampdag-slut">
            <button className="knap knap-primaer" onClick={afslutKamp}>🏁 Afslut kamp og gem</button>
            <button className="knap" onClick={nyKamp}>Ny kamp</button>
          </div>
        </section>
      </div>

      {/* "Hvor i målet?" – vises kun lige efter et skud. key: ny boks for hver hændelse */}
      {hjoerneSpoerg && (
        <HjoerneVaelger
          key={hjoerneSpoerg.haendelseId}
          titel={hjoerneSpoerg.titel}
          onVaelg={vaelgHjoerne}
          spoergSkytte={hjoerneSpoerg.imod === true}
          onSpringOver={skytte => vaelgHjoerne(null, skytte)}
        />
      )}
    </main>
  );
}
