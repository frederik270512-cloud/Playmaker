/*
  SKABELON: "Kontra: hurtigt modløb" – et system på HEL bane (se helBane.js).
  Den ligger her (og ikke i data/skabeloner.js), fordi den bruger den hele bane.
  Den bliver lagt ind af knappen "📚 Tilføj skabeloner" i SystemOversigt.jsx,
  sammen med de andre skabeloner (og kun hvis man ikke allerede har den – sammenlignet på navnet).
*/
import { helBaneStartPos } from "./helBane.js";

export const KONTRA_NAVN = "Kontra: hurtigt modløb";

// Lille hjælper: et nyt trin = en kopi af det forrige, hvor nogle spillere er flyttet
function naesteTrin(forrige, flyt, bold, tekst) {
  const pos = structuredClone(forrige.pos);
  for (const noegle in flyt) pos[noegle] = { x: flyt[noegle][0], y: flyt[noegle][1] };
  return { pos, bold, tekst };
}

export function kontraSkabelon(id) {
  const trin1 = {
    pos: helBaneStartPos(),
    bold: "VM",
    tekst: "Vi har vundet bolden! MV kigger straks op, og fløjene sætter i løb.",
  };
  const trin2 = naesteTrin(trin1, {
    VM: [100, 372],
    VF: [30, 160], HF: [172, 176],                 // fløjene spurter op langs siderne
    VB: [62, 280], C: [100, 272], HB: [138, 282], ST: [100, 240],
    M1: [42, 222], M2: [74, 214], M3: [102, 204], M4: [130, 214], M5: [160, 226], M6: [98, 182],
  }, "VM", "VF og HF spurter op langs siderne. Modstanderne vender om og løber hjem.");
  const trin3 = naesteTrin(trin2, {
    VF: [36, 84], HF: [166, 104],
    VB: [64, 232], C: [100, 222], HB: [136, 234], ST: [100, 190],
    M1: [50, 152], M2: [80, 160], M3: [104, 150], M4: [128, 160], M5: [150, 172], M6: [96, 132],
  }, "VF", "MV kaster langt til VF, der har løbet sig fri i venstre side.");
  const trin4 = naesteTrin(trin3, {
    VF: [62, 48], HF: [160, 70], C: [100, 170], ST: [100, 140],
    M1: [56, 72], M0: [94, 12],
  }, { x: 92, y: -5 }, "VF løber alene mod mål og afslutter, før forsvaret er nået hjem.");

  return {
    id,
    navn: KONTRA_NAVN,
    beskrivelse: "Hurtigt modløb efter en redning eller et boldtab hos modstanderen: " +
                 "målmanden kaster langt til en fløj, der allerede er på vej op ad banen.",
    forsvar: "",
    type: "angreb",
    skabelon: true,
    helBane: true,
    trin: [trin1, trin2, trin3, trin4],
  };
}
