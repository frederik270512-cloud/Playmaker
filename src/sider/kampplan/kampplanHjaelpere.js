/*
  KAMPPLAN-HJÆLPERE – små "rene" funktioner til Kampplan-siden.

  En kampplan ser sådan ud (gemmes i data.kampplaner):
    {
      id, titel, dato, modstanderId,        // modstanderId = id fra data.modstandere (eller null)
      opstilling: null ELLER {               // et ØJEBLIKSBILLEDE (en kopi) – ændres tavlen bagefter,
        kilde: "Nuværende tavle",            // bliver kampplanen ikke ændret
        spillere: { MV: spillerId, VF: ..., ST: ... },
        pladsPositioner: { MV: {x, y}, ... },
      },
      systemIds: [ ... ],                    // id'er fra data.systemer
      noter: "",
    }
*/
import { PLADSER } from "../../data/konstanter.js";
import { standardPladsPositioner, tomOpstilling } from "../../data/standardData.js";
import { idagISO, nytId } from "../../hjaelpere.js";

// En helt ny, tom kampplan
export function nyKampplan(modstanderId = null) {
  return { id: nytId(), titel: "", dato: idagISO(), modstanderId, opstilling: null, systemIds: [], noter: "" };
}

/*
  Data kan komme fra en gammel fil eller være rettet i hånden. Denne funktion giver
  ALTID en kampplan med alle felter i den rigtige form – så siden aldrig går ned.
  (Vi retter ikke i de gemte data – vi læser bare "forsigtigt".)
*/
export function sikrPlan(p) {
  const op = p.opstilling && typeof p.opstilling === "object" ? p.opstilling : null;
  return {
    ...p,
    titel: typeof p.titel === "string" ? p.titel : "",
    dato: typeof p.dato === "string" ? p.dato : "",
    modstanderId: p.modstanderId ?? null,
    opstilling: op && {
      kilde: String(op.kilde ?? ""),
      spillere: { ...tomOpstilling(), ...(op.spillere && typeof op.spillere === "object" ? op.spillere : {}) },
      pladsPositioner: { ...standardPladsPositioner(), ...gyldigePositioner(op.pladsPositioner) },
    },
    systemIds: Array.isArray(p.systemIds) ? p.systemIds : [],
    noter: typeof p.noter === "string" ? p.noter : "",
  };
}

// Kun positioner med rigtige tal kommer med (resten tager standardpositionen)
function gyldigePositioner(pos) {
  const ud = {};
  if (!pos || typeof pos !== "object") return ud;
  for (const plads of PLADSER) {
    const p = pos[plads.rolle];
    if (p && typeof p.x === "number" && typeof p.y === "number") ud[plads.rolle] = { x: p.x, y: p.y };
  }
  return ud;
}

// Titlen der vises, hvis man ikke selv har skrevet en: "Kamp mod Vestby HK"
export function autoTitel(modstander) {
  return modstander && modstander.navn ? `Kamp mod ${modstander.navn}` : "Kampplan";
}

// Den titel der faktisk vises: den man selv har skrevet – ellers den automatiske
export function visTitel(plan, modstander) {
  return plan.titel.trim() || autoTitel(modstander);
}

// Et øjebliksbillede (en KOPI) af en opstilling, klar til at lægge i en kampplan
export function lavSnapshot(kilde, opstilling, pladsPositioner) {
  return {
    kilde,
    spillere: { ...tomOpstilling(), ...structuredClone(opstilling ?? {}) },
    pladsPositioner: { ...standardPladsPositioner(), ...gyldigePositioner(pladsPositioner) },
  };
}

// Sortér planerne: nyeste dato først (datoer "ÅÅÅÅ-MM-DD" kan sammenlignes som tekst)
export function sorterPlaner(planer) {
  return [...planer].sort((a, b) => b.dato.localeCompare(a.dato) || (Number(b.id) || 0) - (Number(a.id) || 0));
}
