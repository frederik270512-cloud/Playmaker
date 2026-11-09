/*
  SYSTEMROLLER – hvem er hvem i et system? Små "rene" hjælpefunktioner.

  I et trin står alle brikker i trin.pos under en nøgle:
    nøgler UDEN "M" (VF, VB, C, HB, HF, ST, evt. ST2) = angriberne – holdet med bolden
    nøgler MED "M"  (M0 = målmand, M1-M6)            = forsvaret – holdet uden bolden

  Et system har en type:
    "angreb"  (standard) – VI er angriberne (gule trøjer), modstanderen forsvarer
    "forsvar"            – VI er forsvaret (M-nøglerne i gule trøjer), modstanderen angriber

  Selve dataene er de samme i begge typer – det er kun "hvem er os?", der skifter.
  Derfor kan al træk-, bold- og animationskode være fælles.
*/
import { ALLE_ANGRIBERE, ROLLER, EKSTRA_ROLLER } from "./data/konstanter.js";

// Er nøglen en forsvarsspiller (M0-M6)?
export function erForsvarsNoegle(noegle) {
  return noegle.startsWith("M");
}

// Er det et forsvarssystem? (Mangler typen, er det et angrebssystem – som alle gamle systemer)
export function erForsvarssystem(system) {
  return system?.type === "forsvar";
}

/*
  Angribernes nøgler i et sæt positioner, i fast rækkefølge (VF, VB, C, HB, HF, ST, ST2).
  Normalt 6 – men 7, hvis systemet bruger en ekstra stregspiller (7 mod 6).
*/
export function angribereIPos(pos) {
  const noegler = Object.keys(pos ?? {}).filter(n => !erForsvarsNoegle(n));
  // Kendte pladser i fast rækkefølge – ukendte (burde ikke findes) til sidst
  const plads = n => (ALLE_ANGRIBERE.includes(n) ? ALLE_ANGRIBERE.indexOf(n) : 99);
  return noegler.sort((a, b) => plads(a) - plads(b));
}

// Angriberne i ét trin
export function angribereI(trin) {
  return angribereIPos(trin?.pos);
}

// Forsvarsspillerne i ét trin (M0, M1 ... M6 i rækkefølge)
export function forsvarereI(trin) {
  return Object.keys(trin?.pos ?? {})
    .filter(erForsvarsNoegle)
    .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
}

/*
  "Vores" spillere i et trin – dem der får løbepile, og som quizzen spørger om:
    angrebssystem → angriberne
    forsvarssystem → forsvarsspillerne (inkl. vores målmand M0)
*/
export function voresNoegler(system, trin) {
  return erForsvarssystem(system) ? forsvarereI(trin) : angribereI(trin);
}

// Er brikken med denne nøgle en af VORE spillere?
export function erVores(system, noegle) {
  return erForsvarssystem(system) ? erForsvarsNoegle(noegle) : !erForsvarsNoegle(noegle);
}

// Navn og farve for en angriber-plads (også ST2). Ukendte nøgler får en grå reserve.
export function rolleInfo(noegle) {
  return ROLLER[noegle] ?? EKSTRA_ROLLER[noegle] ?? { navn: noegle, farve: "#9ca3af", tekst: "#111827" };
}

/*
  En kort beskrivelse af en brik, fx til quizzen og til "title" (vises når musen holdes over):
    angriber        → "VB"
    forsvarsspiller → "forsvarer 3" eller "målmanden"
*/
export function brikNavn(noegle) {
  if (!erForsvarsNoegle(noegle)) return noegle;
  const nr = Number(noegle.slice(1));        // "M3" → 3
  return nr === 0 ? "målmanden" : `forsvarer ${nr}`;
}
