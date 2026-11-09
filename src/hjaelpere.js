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
