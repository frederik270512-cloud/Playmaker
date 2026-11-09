/*
  SKABELONER – klassiske systemer, man kan tage udgangspunkt i.

  En skabelon er et HELT almindeligt system (samme form som i standardData.js). Den eneste
  forskel er feltet skabelon: true, så kortet i oversigten kan vise "📚 Skabelon".
  Når skabelonen er lagt ind i ens systemer, kan man rette i den som i alle andre systemer.

  For at gøre skabelonerne lette at læse, bygger vi dem med små hjælpefunktioner:

    bygTrin(liste, { forsvar, ekstra })  – laver alle trinene ud fra en liste af ÆNDRINGER:
        [
          { tekst: "Startopstilling ...", bold: "C" },              // trin 1 (grundopstillingen)
          { tekst: "C løber ...", flyt: { C: [72, 110] } },          // trin 2: kun det der ændrer sig
          { tekst: "VB skyder", flyt: { VB: [100, 90] }, bold: skud(108) },
        ]
        Hvert trin starter som en kopi af trinet før. "flyt" siger, hvem der flytter hvorhen,
        og "bold" hvem der har bolden bagefter (mangler den, beholder samme spiller bolden).

    spejl(trin)  – vender et trin om (venstre ↔ højre). Så kan "Krydsning C–HB" laves
                   som et spejlbillede af "Krydsning C–VB".

  Husk banens koordinater: 0-200 begge veje, 10 enheder = 1 meter. Målet er øverst (y = 0).
  Grundopstillingen står i konstanter.js (PLADSER og FORSVAR):
    VF (14,26)   VB (42,112)   C (100,128)   HB (158,112)   HF (186,26)   ST (100,76)
    6-0: M1 (20,38)  M2 (50,60)  M3 (78,66)  M4 (122,66)  M5 (150,60)  M6 (180,38)  M0 = målmand
*/
import { PLADSER, FORSVAR, MODSTANDER_MV, ANGRIBERE } from "./konstanter.js";

/* ---------- Hjælpefunktioner ---------- */

// Et skud: bolden lægges inde i målet ved x (85-115 er mellem stolperne)
function skud(x) {
  return [x, -5];
}

// Bolden kan skrives som "VB" (en spiller) eller [x, y] (et punkt) – lav den om til det rigtige format
function tilBold(bold) {
  return Array.isArray(bold) ? { x: bold[0], y: bold[1] } : bold;
}

// Grundopstillingen: vores 6 angribere + forsvaret i formationen (M0 = målmand, M1-M6)
function grundPositioner(forsvar) {
  const pos = {};
  for (const plads of PLADSER) {
    if (ANGRIBERE.includes(plads.rolle)) pos[plads.rolle] = { x: plads.x, y: plads.y };
  }
  [MODSTANDER_MV, ...FORSVAR[forsvar]].forEach(([x, y], i) => { pos["M" + i] = { x, y }; });
  return pos;
}

// Ét nyt trin: en kopi af det forrige, hvor "flyt" og "bold" er lagt ovenpå
function naesteTrin(forrige, { tekst, flyt = {}, bold }) {
  const pos = structuredClone(forrige.pos);
  for (const [noegle, [x, y]] of Object.entries(flyt)) pos[noegle] = { x, y };
  return {
    pos,
    bold: bold === undefined ? structuredClone(forrige.bold) : tilBold(bold),
    tekst,
  };
}

/*
  Byg alle trinene. Det første element i listen er trin 1 – det tager udgangspunkt i
  grundopstillingen (plus "ekstra" spillere, fx ST2 ved 7 mod 6).
  reduce-agtig løkke: hvert trin bygges oven på det forrige.
*/
function bygTrin(liste, { forsvar = "6-0", ekstra = {} } = {}) {
  const grund = { pos: grundPositioner(forsvar), bold: "C" };
  for (const [noegle, [x, y]] of Object.entries(ekstra)) grund.pos[noegle] = { x, y };
  const trin = [];
  let forrige = grund;
  for (const aendring of liste) {
    forrige = naesteTrin(forrige, aendring);
    trin.push(forrige);
  }
  return trin;
}

// Hvem bliver til hvem, når banen spejles (venstre ↔ højre)? Dem der ikke står her, er de samme.
const SPEJL_NOEGLER = {
  VF: "HF", HF: "VF", VB: "HB", HB: "VB",
  M1: "M6", M6: "M1", M2: "M5", M5: "M2", M3: "M4", M4: "M3",
};
const spejlNoegle = noegle => SPEJL_NOEGLER[noegle] ?? noegle;

// Spejl ét trin: x bliver til 200 - x, og venstre-spillerne bytter med højre-spillerne
function spejl(trin) {
  const pos = {};
  for (const [noegle, p] of Object.entries(trin.pos)) pos[spejlNoegle(noegle)] = { x: 200 - p.x, y: p.y };
  const bold = typeof trin.bold === "string" ? spejlNoegle(trin.bold) : { x: 200 - trin.bold.x, y: trin.bold.y };
  return { ...trin, pos, bold };
}

// Selve systemet. id sættes først, når skabelonerne hentes (se skabeloner() nederst).
function skabelon({ navn, beskrivelse, trin, forsvar = "6-0", type = "angreb" }) {
  return { id: 0, navn, beskrivelse, forsvar, type, skabelon: true, trin };
}

/* ---------- 1 + 2: Krydsning C–VB og C–HB ---------- */

function krydsningCVBTrin() {
  return bygTrin([
    { tekst: "Startopstilling mod 6-0. C har bolden midt på banen, VB og HB står bredt bag 9 m." },
    {
      tekst: "C løber skråt mod venstre med bolden og angriber hullet mellem 2'eren og 3'eren. " +
             "3'eren træder ud på C, og ST stiller sig på 3'erens inderside.",
      flyt: { C: [72, 110], M3: [72, 80], M2: [54, 64], ST: [90, 72] },
    },
    {
      tekst: "VB krydser bag om C og starter ind mod midten. C afleverer i krydsningen – " +
             "lige når VB passerer bag hans ryg.",
      flyt: { VB: [90, 104], C: [60, 104], M4: [112, 72] },
      bold: "VB",
    },
    {
      tekst: "VB går i hullet mellem 3'eren og 4'eren og afslutter med et hoppeskud fra 9 m. " +
             "Lukker 4'eren hullet, er ST fri på stregen.",
      flyt: { VB: [100, 90], M4: [110, 76], ST: [92, 68] },
      bold: skud(108),
    },
  ]);
}

function krydsningCVB() {
  return skabelon({
    navn: "Krydsning C–VB",
    beskrivelse: "Klassisk krydsning i venstre side: C binder 3'eren, VB krydser bag om C " +
                 "og angriber hullet mellem 3'eren og 4'eren. ST hjælper med en spærring.",
    trin: krydsningCVBTrin(),
  });
}

function krydsningCHB() {
  // Præcis det samme løb – bare spejlet over i højre side. Teksterne skrives om.
  const tekster = [
    "Startopstilling mod 6-0. C har bolden midt på banen, VB og HB står bredt bag 9 m.",
    "C løber skråt mod højre med bolden og angriber hullet mellem 4'eren og 5'eren. " +
      "4'eren træder ud på C, og ST stiller sig på 4'erens inderside.",
    "HB krydser bag om C og starter ind mod midten. C afleverer i krydsningen – " +
      "lige når HB passerer bag hans ryg.",
    "HB går i hullet mellem 4'eren og 3'eren og afslutter med et hoppeskud fra 9 m. " +
      "Lukker 3'eren hullet, er ST fri på stregen.",
  ];
  return skabelon({
    navn: "Krydsning C–HB",
    beskrivelse: "Spejlbilledet af C–VB: C binder 4'eren, HB krydser bag om C " +
                 "og angriber hullet mellem 4'eren og 3'eren.",
    trin: krydsningCVBTrin().map((t, i) => ({ ...spejl(t), tekst: tekster[i] })),
  });
}

/* ---------- 3: Krydsning back–fløj ---------- */

function krydsningBackFloej() {
  return skabelon({
    navn: "Krydsning back–fløj",
    beskrivelse: "VB og VF bytter plads i en krydsning. VB binder 2'eren ude i siden, " +
                 "og VF kommer ind i back-positionen med fart mod hullet mellem 2'eren og 3'eren.",
    trin: bygTrin([
      { tekst: "Startopstilling mod 6-0. C har bolden." },
      {
        tekst: "C spiller til VB. VF løber op langs sidelinjen og gør sig klar til krydsningen.",
        flyt: { VF: [20, 64], M1: [24, 48] },
        bold: "VB",
      },
      {
        tekst: "VB trækker skråt ud mod fløjen med bolden og binder 2'eren. " +
               "VF krydser ind bag om VB og får bolden i krydsningen.",
        flyt: { VB: [30, 96], VF: [46, 100], M2: [40, 74] },
        bold: "VF",
      },
      {
        tekst: "Nu har de byttet plads: VB fortsætter ud på fløjen, " +
               "og VF angriber hullet mellem 2'eren og 3'eren.",
        flyt: { VB: [16, 40], VF: [62, 86], M1: [22, 44], M3: [72, 74] },
      },
      {
        tekst: "2'eren hænger fast ude ved VB, så VF kommer igennem og skyder fra 8 m.",
        flyt: { VF: [64, 82] },
        bold: skud(94),
      },
    ]),
  });
}

/* ---------- 4: Spærring med stregen (slør) ---------- */

function spaerringMedStregen() {
  return skabelon({
    navn: "Spærring med stregen",
    beskrivelse: "ST sætter en spærring (slør) på 3'erens inderside. VB går tæt forbi spærringen " +
                 "og bryder igennem, fordi 3'eren ikke kan glide med ind.",
    trin: bygTrin([
      { tekst: "Startopstilling mod 6-0. C har bolden, ST står midt på stregen." },
      {
        tekst: "C spiller til VB. ST går op og sætter en spærring på 3'erens inderside – " +
               "bred og stille, med armene ind til kroppen.",
        flyt: { ST: [90, 70] },
        bold: "VB",
      },
      {
        tekst: "VB trækker ind mod midten og angriber 3'eren. 3'eren vil glide med, " +
               "men står fast i ST's spærring.",
        flyt: { VB: [70, 98], M3: [78, 72], M4: [114, 70] },
      },
      {
        tekst: "VB går tæt forbi spærringen og bryder igennem mellem 3'eren og 4'eren. " +
               "4'eren må træde ud for at hjælpe.",
        flyt: { VB: [94, 88], M4: [106, 78] },
      },
      {
        tekst: "VB skyder fra 8 m. (Træder 4'eren helt ud, kan VB i stedet spille ST fri, " +
               "når han ruller af mod mål.)",
        flyt: { VB: [96, 84] },
        bold: skud(106),
      },
    ]),
  });
}

/* ---------- 5: 7 mod 6 (tomt mål) ---------- */

function syvModSeks() {
  return skabelon({
    navn: "7 mod 6 (tomt mål)",
    beskrivelse: "Målmanden skiftes ud med en 7. markspiller, så vi har to stregspillere (ST og ST2). " +
                 "Forsvaret skal dække én mand mere, end de har – find overtallet. Pas på det tomme mål ved boldtab!",
    trin: bygTrin([
      {
        tekst: "7 mod 6: målmanden er skiftet ud med en ekstra markspiller. ST står mellem 2'eren " +
               "og 3'eren, ST2 mellem 4'eren og 5'eren.",
        flyt: { ST: [64, 72] },
      },
      {
        tekst: "C spiller til HB. Forsvaret forskyder mod boldsiden.",
        flyt: { M3: [86, 68], M4: [128, 68], M5: [154, 64], M6: [182, 42] },
        bold: "HB",
      },
      {
        tekst: "HB angriber hullet mellem 4'eren og 5'eren. 5'eren træder ud på HB, " +
               "og ST2 spærrer 4'eren, så han ikke kan hjælpe.",
        flyt: { HB: [146, 98], M5: [148, 80], ST2: [132, 70] },
      },
      {
        tekst: "HB spiller ind til ST2, der vender ind i hullet bag 5'eren. Der er altid én mand i overtal.",
        flyt: { ST2: [148, 62], M4: [130, 74] },
        bold: "ST2",
      },
      {
        tekst: "ST2 afslutter fra 6 m. Husk: ved boldtab skal en spiller straks løbe ud, " +
               "så målmanden kan komme ind igen – målet er tomt!",
        bold: skud(110),
      },
    ], { ekstra: { ST2: [136, 72] } }),
  });
}

/* ---------- 6: Forsvar – 6-0 mod krydsning ---------- */

/*
  Et FORSVARSSYSTEM (type: "forsvar"): her er VI M1-M6 (og målmanden M0),
  og modstanderen angriber med VF, VB, C ... Positionerne skrives præcis som ellers.
*/
function seksNulModKrydsning() {
  return skabelon({
    navn: "6-0 forsvar mod krydsning",
    type: "forsvar",
    beskrivelse: "Modstanderen spiller en krydsning mellem C og VB. Vi bliver i vores 6-0: " +
                 "3'eren møder C, 4'eren overtager VB i krydsningen, og de andre dækker ind bag.",
    trin: bygTrin([
      { tekst: "Vi står i 6-0 på 6 m. Modstanderens C har bolden. Alle har front mod bolden og armene oppe." },
      {
        tekst: "C trækker skråt mod vores 3'er. 3'eren træder frem og møder C ved 8 m. " +
               "2'eren og 4'eren rykker lidt ind og dækker bag ham.",
        flyt: { C: [72, 110], M3: [74, 84], M2: [54, 64], M4: [110, 70] },
      },
      {
        tekst: "VB krydser bag om C og får bolden. 3'eren bliver hos C – han løber IKKE med i krydsningen. " +
               "4'eren overtager VB (vi bytter).",
        flyt: { VB: [90, 104], C: [60, 104], ST: [104, 72], M3: [68, 84], M4: [98, 82] },
        bold: "VB",
      },
      {
        tekst: "4'eren går frem og stopper VB foran 9 m. 3'eren falder tilbage til 6 m og tager ST, " +
               "og 5'eren dækker ind mod midten bag 4'eren.",
        flyt: { VB: [96, 96], M4: [96, 86], M3: [88, 68], M5: [116, 68], M6: [172, 42] },
      },
      {
        tekst: "Der er intet hul, så VB må spille videre til HB. 4'eren falder tilbage, " +
               "5'eren går ud på HB, og vi forskyder mod boldsiden – klar til næste angreb.",
        flyt: { VB: [86, 108], M3: [82, 66], M4: [118, 68], M5: [148, 72], M6: [178, 40] },
        bold: "HB",
      },
    ]),
  });
}

/* ---------- Alle skabelonerne ---------- */

/*
  Giver NYE kopier af alle skabelonerne (hver gang funktionen kaldes).
  startId: det id, den første skabelon får – de næste får startId + 1, + 2 ...
*/
export function skabeloner(startId = Date.now()) {
  return [
    krydsningCVB(),
    krydsningCHB(),
    krydsningBackFloej(),
    spaerringMedStregen(),
    syvModSeks(),
    seksNulModKrydsning(),
  ].map((s, i) => ({ ...s, id: startId + i }));
}

/*
  De skabeloner, der MANGLER i en liste af systemer (sammenlignet på navnet).
  Bruges af knappen "📚 Tilføj skabeloner" – så får man ikke den samme skabelon to gange.
  Har man omdøbt en skabelon, tæller den ikke længere som "tilføjet".
*/
export function manglendeSkabeloner(systemer, startId) {
  const navne = new Set(systemer.map(s => s.navn));
  return skabeloner(startId).filter(s => !navne.has(s.navn));
}
