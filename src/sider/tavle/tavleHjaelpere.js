/*
  HJÆLPEFUNKTIONER TIL TAKTIKTAVLEN

  De fleste af dem får "d" (en KOPI af appens data, fra opdater()) og retter i den.
  Brug dem sådan her:
      opdater(d => saetPaaPlads(d, spillerId, "VB"));
*/
import { standardPladsPositioner } from "../../data/standardData.js";
import { begraens, baneViewBox, bundGraense } from "../../hjaelpere.js";

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
// helBane = true: tavlen viser hel bane (viewBox VIEWBOX_HEL), så man må gå helt ned til vores eget mål.
export function skaermTilTavle(baneElement, clientX, clientY, helBane = false) {
  const vb = baneViewBox(helBane);
  const boks = baneElement.getBoundingClientRect();
  return {
    x: begraens(vb.x + ((clientX - boks.left) / boks.width) * vb.bredde, -8, 208),
    y: begraens(vb.y + ((clientY - boks.top) / boks.height) * vb.hoejde, -18, bundGraense(helBane)),
  };
}

// Den nederste grænse på den halve bane (lidt under kanten, som ved træk)
const HALV_BUND = 208;

// Et punkt holdt inde på den halve bane (bruges når man skifter fra hel til halv bane)
function tilHalv(p) {
  return { x: p.x, y: Math.min(p.y, HALV_BUND) };
}

/*
  Skift tavlen mellem halv og hel bane. "d" er en kopi af appens data (fra opdater()).
    → hel bane:  vores målmand flytter ned til sit mål – men kun hvis han stod på sin halv-bane-plads
                 (har man selv flyttet ham, bliver han stående)
    → halv bane: alt under y = 200 skubbes op på den halve bane; målmanden tilbage til sin plads (186).
  Opstillingen (hvem står hvor) ændres ALDRIG – kun positionerne.
*/
export function skiftTavleBane(d, helBane) {
  d.tavleHelBane = helBane;
  const halvMV = standardPladsPositioner(false).MV;
  if (helBane) {
    const mv = d.pladsPositioner.MV;
    if (mv.x === halvMV.x && mv.y === halvMV.y) d.pladsPositioner.MV = standardPladsPositioner(true).MV;
    return;
  }
  for (const rolle in d.pladsPositioner) {
    const p = d.pladsPositioner[rolle];
    if (p.y > 200) d.pladsPositioner[rolle] = rolle === "MV" ? { ...halvMV } : tilHalv(p);
  }
  d.modstander.positioner = d.modstander.positioner.map(tilHalv);
  d.tegning = d.tegning.map(s => ({ ...s, punkter: s.punkter.map(tilHalv) }));
}
