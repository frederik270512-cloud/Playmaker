/*
  SYSTEMER PÅ HEL BANE (kontra / omstilling) – små "rene" hjælpefunktioner.

  Et system med helBane: true vises på en HEL bane, der står på højkant (se BaneSVG.jsx):
    x: 0-200 (samme bredde som den halve bane), y: 0-400
    y = 0 → modstandernes mål øverst (vi angriber stadig opad), y = 200 → midterlinjen,
    y = 400 → vores eget mål nederst.
  Den øverste halvdel har de SAMME koordinater som en halv bane. Derfor kan et system
  på halv bane flyttes over på hel bane uden at regne om – det står bare i den øverste halvdel.

  Nøglen "VM" er målmanden for holdet MED bolden (se SystemFigur i Figur.jsx).
  Den bruges kun på hel bane, hvor et kontraangreb typisk starter med et langt kast fra målmanden.
*/
import { harForgrening } from "../../systemVarianter.js";

/*
  Startopstilling til et kontraangreb: vi har lige vundet bolden i vores eget forsvar.
  Vores målmand (VM) har bolden ved vores eget mål nederst, vores spillere står spredt omkring
  vores 6-9 m, og modstanderne (der lige har angrebet) er på vej tilbage.
  M0 = modstanderens målmand i målet øverst.
*/
export function helBaneStartPos() {
  return {
    VM: { x: 100, y: 384 },
    VF: { x: 26,  y: 344 },
    VB: { x: 62,  y: 322 },
    C:  { x: 100, y: 314 },
    HB: { x: 138, y: 322 },
    HF: { x: 174, y: 344 },
    ST: { x: 100, y: 292 },
    M0: { x: 100, y: 12 },
    M1: { x: 34,  y: 286 },
    M2: { x: 70,  y: 276 },
    M3: { x: 104, y: 266 },
    M4: { x: 134, y: 278 },
    M5: { x: 166, y: 288 },
    M6: { x: 96,  y: 232 },
  };
}

/*
  Et nyt system på hel bane med ét trin. type = "angreb" (kontra) eller "forsvar" (omstilling,
  hvor VI er forsvaret og skal hjem). Positionerne er de samme – kun "hvem er os?" skifter.
  forsvar = "" fordi modstanderne ikke står i en formation, når de løber hjem.
*/
export function nytHelBaneSystemData(navn, type = "angreb") {
  return {
    id: Date.now(), navn, beskrivelse: "", forsvar: "",
    type: type === "forsvar" ? "forsvar" : "angreb",
    helBane: true,
    trin: [{ pos: helBaneStartPos(), bold: "VM" }],
  };
}

// Kør fn på ALLE trin i systemet – også trinene i alle varianter. Giver et nyt system.
function aendrAlleTrin(system, fn) {
  const nyt = { ...system, trin: system.trin.map(fn) };
  if (harForgrening(system)) {
    nyt.forgrening = {
      ...system.forgrening,
      varianter: system.forgrening.varianter.map(v => ({ ...v, trin: v.trin.map(fn) })),
    };
  }
  return nyt;
}

// Står nogen (eller bolden) i den nederste halvdel af en hel bane i nogen trin?
export function brugerNederstePart(system) {
  const alle = [...system.trin];
  if (harForgrening(system)) system.forgrening.varianter.forEach(v => alle.push(...v.trin));
  return alle.some(t =>
    Object.values(t.pos).some(p => p.y > 205) ||
    (typeof t.bold === "object" && t.bold !== null && t.bold.y > 205));
}

/*
  Halv → hel bane: koordinaterne er de samme, så vi skal bare sætte flaget.
  Hel → halv bane: alt, der står på den anden side af midterlinjen, flyttes op til lige
  inden for midterlinjen (y = 195). Vores målmand (VM) findes ikke på en halv bane, så han
  fjernes – havde han bolden, får den første angriber den i stedet.
*/
export function skiftBane(system, helBane) {
  if (helBane) return { ...system, helBane: true };
  const op = p => (p.y > 195 ? { x: p.x, y: 195 } : p);
  const halv = aendrAlleTrin(system, t => {
    const pos = {};
    for (const noegle in t.pos) if (noegle !== "VM") pos[noegle] = op(t.pos[noegle]);
    let bold = t.bold;
    if (bold === "VM") bold = Object.keys(pos).find(n => !n.startsWith("M")) ?? { x: 100, y: 120 };
    else if (typeof bold === "object" && bold !== null) bold = op(bold);
    return { ...t, pos, bold };
  });
  delete halv.helBane;
  return halv;
}

// Er systemet (eller det effektive system) på hel bane?
export function erHelBane(system) {
  return system?.helBane === true;
}
