/*
  HJÆLPEFUNKTIONER TIL TAKTIKTAVLEN

  De fleste af dem får "d" (en KOPI af appens data, fra opdater()) og retter i den.
  Brug dem sådan her:
      opdater(d => saetPaaPlads(d, spillerId, "VB"));
*/
import { VIEWBOX } from "../../data/konstanter.js";
import { begraens } from "../../hjaelpere.js";

// Hvilken plads står spilleren på? Fx "VB" – eller null hvis han sidder på bænken.
export function findPladsFor(opstilling, spillerId) {
  for (const plads in opstilling) {
    if (opstilling[plads] === spillerId) return plads;
  }
  return null;
}

// Sæt en spiller på en plads. Er pladsen optaget, bytter de.
export function saetPaaPlads(d, spillerId, tilPlads) {
  const fraPlads = findPladsFor(d.opstilling, spillerId);   // null = han kommer fra bænken
  if (fraPlads === tilPlads) return;                        // sluppet på sin egen plads

  const andenSpiller = d.opstilling[tilPlads];              // hvem står der i forvejen? (kan være null)
  d.opstilling[tilPlads] = spillerId;

  // Kom han fra en anden plads, flytter den anden spiller over på den ledige plads.
  // Kom han fra bænken, står den anden spiller ikke længere i opstillingen = han er på bænken.
  if (fraPlads !== null) d.opstilling[fraPlads] = andenSpiller;
}

// Tag en spiller af banen (send ham på bænken)
export function sendTilPanel(d, spillerId) {
  const fraPlads = findPladsFor(d.opstilling, spillerId);
  if (fraPlads !== null) d.opstilling[fraPlads] = null;
}

// Skærmposition (pixels) → banens koordinater. Holdes inden for banen.
export function skaermTilTavle(baneElement, clientX, clientY) {
  const boks = baneElement.getBoundingClientRect();
  return {
    x: begraens(VIEWBOX.x + ((clientX - boks.left) / boks.width) * VIEWBOX.bredde, -8, 208),
    y: begraens(VIEWBOX.y + ((clientY - boks.top) / boks.height) * VIEWBOX.hoejde, -18, 208),
  };
}
