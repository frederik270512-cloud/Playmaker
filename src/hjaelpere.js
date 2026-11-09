/*
  HJÆLPEFUNKTIONER – små funktioner der bruges mange steder i appen.
  De er "rene": de får noget ind og giver noget tilbage, uden at ændre noget andet.
*/
import { ROLLE_RAEKKEFOELGE, VIEWBOX } from "./data/konstanter.js";

// Dagens dato som tekst "ÅÅÅÅ-MM-DD" (samme format som <input type="date">)
export function idagISO() {
  const d = new Date();
  const maaned = String(d.getMonth() + 1).padStart(2, "0");   // getMonth() starter ved 0!
  const dag = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${maaned}-${dag}`;
}

// "2026-11-01" → "1. nov. 2026"
export function formatDato(iso) {
  if (!iso) return "–";
  return new Date(iso + "T00:00").toLocaleDateString("da-DK", { day: "numeric", month: "short", year: "numeric" });
}

// Antal dage mellem to datoer
export function dageMellem(fraISO, tilISO) {
  const millisekunderPrDag = 24 * 60 * 60 * 1000;
  return Math.round((new Date(tilISO + "T00:00") - new Date(fraISO + "T00:00")) / millisekunderPrDag);
}

// Er skaden aktiv i dag? (Datoer i formatet ÅÅÅÅ-MM-DD kan sammenlignes direkte som tekst.)
export function erAktiv(skade) {
  const idag = idagISO();
  return skade.fra <= idag && (skade.til === "" || skade.til >= idag);
}

// Spillerens aktive skade – eller null hvis spilleren er klar
export function aktivSkade(spiller) {
  return spiller.skader.find(erAktiv) || null;
}

// Må spilleren stå på pladsen uden advarsel? (primær ELLER sekundær position)
export function passerTilPlads(spiller, plads) {
  return plads === spiller.rolle || plads === spiller.sekundaer;
}

// En kopi af listen sorteret efter position og derefter trøjenummer
export function sorteretTrup(liste) {
  return [...liste].sort((a, b) =>
    ROLLE_RAEKKEFOELGE.indexOf(a.rolle) - ROLLE_RAEKKEFOELGE.indexOf(b.rolle) || a.nummer - b.nummer);
}

// Banens koordinater (x, y) → procent af banens bredde/højde (til style.left/top)
export function tilProcent(x, y) {
  return {
    left: ((x - VIEWBOX.x) / VIEWBOX.bredde) * 100 + "%",
    top: ((y - VIEWBOX.y) / VIEWBOX.hoejde) * 100 + "%",
  };
}

// Skærmposition (pixels) → banens koordinater, ud fra et elements placering på skærmen
export function skaermTilBane(element, clientX, clientY) {
  const boks = element.getBoundingClientRect();
  return {
    x: VIEWBOX.x + ((clientX - boks.left) / boks.width) * VIEWBOX.bredde,
    y: VIEWBOX.y + ((clientY - boks.top) / boks.height) * VIEWBOX.hoejde,
  };
}

/*
  HEL BANE (kontra/omstilling) – en hel bane står på HØJKANT (lodret), så den er lige så bred
  som den halve bane. Banen går fra (0,0) til (200,400), 1 enhed = 10 cm (40 x 20 m):
    y = 0   → modstandernes mål øverst (det vi angriber – præcis som på den halve bane)
    y = 200 → midterlinjen
    y = 400 → vores eget mål nederst
  Den øverste halvdel har altså NØJAGTIG de samme koordinater som den halve bane.
  Derfor virker mål-kassen (MAAL), skud og forsvarsformationerne uændret.
*/
export const HEL_BANE_LAENGDE = 400;
export const VIEWBOX_HEL = { x: -15, y: -30, bredde: 230, hoejde: 460 };

// Den rigtige viewBox for et system: hel bane eller halv bane
export function baneViewBox(helBane) {
  return helBane ? VIEWBOX_HEL : VIEWBOX;
}

// viewBox som tekst til <svg viewBox="...">, fx "-15 -30 230 460"
export function viewBoxTekst(vb) {
  return `${vb.x} ${vb.y} ${vb.bredde} ${vb.hoejde}`;
}

// Som tilProcent – men for en valgfri viewBox (fx VIEWBOX_HEL)
export function tilProcentI(vb, x, y) {
  return {
    left: ((x - vb.x) / vb.bredde) * 100 + "%",
    top: ((y - vb.y) / vb.hoejde) * 100 + "%",
  };
}

// Som skaermTilBane – men for en valgfri viewBox (fx VIEWBOX_HEL)
export function skaermTilBaneI(vb, element, clientX, clientY) {
  const boks = element.getBoundingClientRect();
  return {
    x: vb.x + ((clientX - boks.left) / boks.width) * vb.bredde,
    y: vb.y + ((clientY - boks.top) / boks.height) * vb.hoejde,
  };
}

// Hvor langt ned må en brik/bold trækkes? (lidt uden for banen – også ind i målet nederst)
export function bundGraense(helBane) {
  return helBane ? HEL_BANE_LAENGDE + 10 : 210;
}

// Holder et tal inden for et interval
export function begraens(tal, min, max) {
  return Math.min(max, Math.max(min, tal));
}

// Tal med én decimal og dansk komma: 2.5 → "2,5"
export function decimal(tal) {
  return tal.toFixed(1).replace(".", ",");
}

// Lægger et felt sammen for en liste, fx sumAf(kampe, "maal") = mål i alt
export function sumAf(liste, felt) {
  return liste.reduce((total, element) => total + (Number(element[felt]) || 0), 0);
}

// 754 sekunder → "12:34"
export function formatUr(sek) {
  const s = Math.max(0, Math.floor(sek));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

// Et nyt unikt id (tidspunkt i millisekunder + lidt tilfældighed)
export function nytId() {
  return Date.now() + Math.floor(Math.random() * 1000);
}
