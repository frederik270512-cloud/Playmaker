/*
  STANDARDDATA – det appen starter med første gang (før man har gemt noget selv),
  og funktioner der laver "tomme" ting, fx et nyt system eller en ny kamp.
*/
import { PLADSER, FORSVAR, MODSTANDER_MV, ANGRIBERE } from "./konstanter.js";
import { idagISO } from "../hjaelpere.js";
import { skabeloner } from "./skabeloner.js";

/*
  Hver spiller:
    id, nummer, navn, rolle (primær position), sekundaer ("" = ingen),
    skader: [{ id, type, fra, til, note }]   (til = "" betyder: stadig skadet)
    kampe:  [{ id, dato, modstander, maal, assists, afbraendere, tekniskeFejl }]
    styrker, svagheder, oevelse (tekst til evalueringen)
*/
export const STANDARD_SPILLERE = [
  { id: 1,  nummer: 1,  navn: "Kasper",   rolle: "MV", sekundaer: "" },
  { id: 2,  nummer: 16, navn: "Emil",     rolle: "MV", sekundaer: "" },
  { id: 3,  nummer: 4,  navn: "Oliver",   rolle: "VF", sekundaer: "" },
  { id: 4,  nummer: 7,  navn: "Jonas",    rolle: "VB", sekundaer: "C" },
  {
    id: 5, nummer: 9, navn: "Mads", rolle: "C", sekundaer: "HB",
    // Eksempel på kampe og evaluering (opdigtede tal, så man kan se hvordan historikken ser ud)
    kampe: [
      { id: 1, dato: "2026-09-14", modstander: "Vestby HK",     maal: 5, assists: 4, afbraendere: 2, tekniskeFejl: 1 },
      { id: 2, dato: "2026-09-28", modstander: "Søndervig IF",  maal: 2, assists: 6, afbraendere: 4, tekniskeFejl: 3 },
      { id: 3, dato: "2026-10-12", modstander: "Nordkysten HH", maal: 7, assists: 3, afbraendere: 1, tekniskeFejl: 0 },
      { id: 4, dato: "2026-10-26", modstander: "Vestby HK",     maal: 4, assists: 5, afbraendere: 2, tekniskeFejl: 2 },
    ],
    styrker: "Overblik og timing i afleveringerne. Stærk i 1 mod 1 mod venstre.",
    svagheder: "Skud fra 9 meter under pres.",
    oevelse: "Hoppeskud fra distancen og færre tekniske fejl i højt tempo.",
  },
  { id: 6,  nummer: 23, navn: "Anton",    rolle: "C",  sekundaer: "VB" },
  {
    id: 7, nummer: 11, navn: "Victor", rolle: "HB", sekundaer: "",
    skader: [{ id: 1, type: "Forstuvet ankel", fra: "2026-11-01", til: "", note: "Forventes klar om ca. 3 uger" }],
    kampe: [
      { id: 1, dato: "2026-10-12", modstander: "Nordkysten HH", maal: 6, assists: 1, afbraendere: 3, tekniskeFejl: 1 },
      { id: 2, dato: "2026-10-26", modstander: "Vestby HK",     maal: 8, assists: 2, afbraendere: 2, tekniskeFejl: 0 },
    ],
  },
  { id: 8,  nummer: 14, navn: "Noah",     rolle: "HF", sekundaer: "VF" },
  { id: 9,  nummer: 18, navn: "Magnus",   rolle: "ST", sekundaer: "" },
  { id: 10, nummer: 25, navn: "Malthe",   rolle: "VF", sekundaer: "HF" },
  { id: 11, nummer: 3,  navn: "Frederik", rolle: "C",  sekundaer: "" },
];

// Modstandernes startpositioner for en formation (målmand først). "" = intet forsvar.
export function startPositioner(formation) {
  if (!FORSVAR[formation]) return [];
  return [MODSTANDER_MV, ...FORSVAR[formation]].map(([x, y]) => ({ x, y }));
}

// Pladsernes standardpositioner på tavlen: { MV: {x, y}, VF: {x, y}, ... }
export function standardPladsPositioner() {
  const pos = {};
  for (const plads of PLADSER) pos[plads.rolle] = { x: plads.x, y: plads.y };
  return pos;
}

// En tom opstilling (ingen spillere på banen)
export function tomOpstilling() {
  return { MV: null, VF: null, VB: null, C: null, HB: null, HF: null, ST: null };
}

/*
  Et nyt system med ét trin. Et trin er et "billede" af hvor alle står, og hvem der har bolden:
    { pos: { VF: {x, y}, ..., M0: {x, y}, M1: ... }, bold: "C", tekst: "forklaring" }
  bold er enten en spiller ("C") eller et punkt på banen ({x, y}) – i målet = skud.

  type er "angreb" (vi angriber – standard) eller "forsvar" (vi forsvarer, se systemRoller.js).
  Positionerne er de samme i begge typer – det er kun "hvem er os?", der skifter.
*/
export function nytSystemData(navn, forsvar = "6-0", type = "angreb") {
  const pos = {};
  for (const plads of PLADSER) {
    if (ANGRIBERE.includes(plads.rolle)) pos[plads.rolle] = { x: plads.x, y: plads.y };
  }
  startPositioner(forsvar).forEach((p, i) => { pos["M" + i] = p; });
  return {
    id: Date.now(), navn, beskrivelse: "", forsvar,
    type: type === "forsvar" ? "forsvar" : "angreb",
    trin: [{ pos, bold: "C" }],
  };
}

export function eksempelSystem() {
  const s = nytSystemData("Krydsning C → VB");
  s.id = 1;
  s.beskrivelse = "Center trækker til venstre med bolden og binder forsvarer 3. " +
                  "Stregspilleren sætter skærm, og venstre back krydser bag om og får bolden i midten.";
  s.trin[0].tekst = "Startopstilling. C har bolden midt på banen.";
  const trin2 = structuredClone(s.trin[0]);
  trin2.tekst = "C trækker til venstre og binder 3'eren. ST sætter skærm.";
  trin2.pos.C = { x: 68, y: 112 };
  trin2.pos.ST = { x: 80, y: 72 };
  trin2.pos.M3 = { x: 74, y: 84 };
  const trin3 = structuredClone(trin2);
  trin3.tekst = "VB krydser bag om C og får bolden i midten – kig efter hullet ved 4'eren.";
  trin3.pos.VB = { x: 100, y: 100 };
  trin3.pos.C = { x: 58, y: 106 };
  trin3.pos.M4 = { x: 110, y: 74 };
  trin3.bold = "VB";
  const trin4 = structuredClone(trin3);
  trin4.tekst = "VB afslutter med et hoppeskud i målets højre side.";
  trin4.pos.VB = { x: 104, y: 94 };
  trin4.bold = { x: 109, y: -5 };     // et punkt inde i målet = skud

  /*
    Variant B: 3'eren træder ud på C → så er der plads ude på venstre fløj.
    C afleverer til VF, der starter ind fra hjørnet og skyder.
  */
  const b1 = structuredClone(trin2);
  b1.tekst = "3'eren træder ud på C. C afleverer hurtigt til VF, der starter ind fra hjørnet.";
  b1.pos.M3 = { x: 70, y: 96 };       // 3'eren går helt ud på C
  b1.pos.M2 = { x: 46, y: 66 };       // 2'eren må dække lidt ind mod midten
  b1.pos.VF = { x: 30, y: 32 };
  b1.bold = "VF";
  const b2 = structuredClone(b1);
  b2.tekst = "VF hopper ind i feltet og skyder ved den nærmeste stolpe.";
  b2.pos.VF = { x: 44, y: 24 };
  b2.pos.M1 = { x: 30, y: 30 };       // fløjforsvareren når ikke at lukke
  b2.bold = { x: 90, y: -5 };         // skud ved den nærmeste stolpe

  // De fælles trin er trin 1-2. Derefter deler systemet sig i to varianter.
  s.trin.push(trin2);
  s.forgrening = {
    spoergsmaal: "Træder 3'eren ud på C?",
    varianter: [
      { id: "eksempel-a", navn: "Nej – VB krydser bag om", trin: [trin3, trin4] },
      { id: "eksempel-b", navn: "Ja – aflever til VF", trin: [b1, b2] },
    ],
  };
  return s;
}

export function eksempelModstander() {
  return {
    id: 1,
    navn: "Vestby HK",
    forsvar: "6-0",
    styrker: "Hurtige kontraangreb via fløjene. Kompakt 6-0-forsvar med høje blokke midt for.",
    opmaerksom: "Deres #7 skyder hårdt fra 9 meter – gå ud på ham tidligt.\nMålmanden er svag i de lave hjørner.",
    noter: "Sidste kamp gik det bedst, når vi spillede hurtigt og brugte krydsninger mellem C og VB.",
    noeglespillere: [
      { id: 1, nummer: 7,  navn: "Kristian", position: "HB", note: "Venstrehåndet. Hårdt skud fra 9 m." },
      { id: 2, nummer: 1,  navn: "Simon",    position: "MV", note: "Stærk på 1 mod 1, men svag lavt." },
      { id: 3, nummer: 22, navn: "Lasse",    position: "ST", note: "Sætter gode skærme – snak sammen ved byt." },
    ],
  };
}

// En helt ny, tom kamp til Kampdag
export function nyKampdag() {
  return {
    modstander: "",
    dato: idagISO(),
    halvlegMin: 30,      // længde af en halvleg i minutter
    halvleg: 1,
    sekunder: 0,         // kamptid der var gået, sidst uret blev stoppet
    koerer: false,
    startetVed: null,    // Date.now() da uret sidst blev startet
    hjemme: 0,
    ude: 0,
    stats: {},           // { spillerId: { maal, assists, afbraendere, tekniskeFejl, udvisninger } }
    med: {},             // { spillerId: true/false }
    udvisninger: [],     // aktive: { id, spillerId, slutSek }
    haendelser: [],      // log: { id, sek, type, spillerId, tekst, udvId }
  };
}

// HELE appens data, som det ser ud første gang
export function standardData() {
  return {
    version: 1,
    spillere: structuredClone(STANDARD_SPILLERE),
    opstilling: tomOpstilling(),
    pladsPositioner: standardPladsPositioner(),
    modstander: { formation: "6-0", positioner: startPositioner("6-0") },
    // Eksemplet + de klassiske skabeloner (se skabeloner.js). Skabelonerne får id 2, 3, 4 ...
    systemer: [eksempelSystem(), ...skabeloner(2)],
    modstandere: [eksempelModstander()],
    opstillinger: [],
    tegning: [],
    kampdag: nyKampdag(),
    kampResultater: [],    // holdets resultater (Kampdag → Statistik)
    personligeMaal: [],    // personlige mål pr. spiller (Statistik/Spillere)
    kampplaner: [],        // kampplaner (Kampplan-siden)
  };
}

// Tomme data (bruges når man henter en fil – så kommer der kun det med, der står i filen)
export function tommeData() {
  return {
    ...standardData(),
    spillere: [],
    systemer: [],
    modstandere: [],
  };
}
