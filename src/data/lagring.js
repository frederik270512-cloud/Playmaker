/*
  LAGRING – gem og hent data i browserens hukommelse (localStorage),
  og "rens" data fra ældre versioner eller fra en fil, så de altid har den rigtige form.

  Filformatet er det SAMME som i den gamle taktiktavle.html, så man kan flytte sine data
  over med "Gem fil" i den gamle og "Hent fil" i den nye.
*/
import { LAGER_NOEGLE, ROLLER } from "./konstanter.js";
import { standardData, nyKampdag } from "./standardData.js";

// Sørger for at en spiller har alle felter, og at tallene er rigtige tal
export function sikrSpiller(s) {
  return {
    ...s,
    nummer: Number(s.nummer) || 0,
    navn: String(s.navn ?? ""),
    sekundaer: ROLLER[s.sekundaer] ? s.sekundaer : "",
    // Skader skal have en startdato (tekst) – til og note bliver tom tekst, hvis de mangler
    skader: (Array.isArray(s.skader) ? s.skader : [])
      .filter(sk => sk && typeof sk === "object" && typeof sk.fra === "string" && sk.fra)
      .map(sk => ({ ...sk, type: String(sk.type ?? ""), til: String(sk.til ?? ""), note: String(sk.note ?? "") })),
    kampe: (Array.isArray(s.kampe) ? s.kampe : []).filter(k => k && typeof k === "object").map(k => ({
      ...k,
      modstander: String(k.modstander ?? ""),
      maal: Number(k.maal) || 0,
      assists: Number(k.assists) || 0,
      afbraendere: Number(k.afbraendere) || 0,
      tekniskeFejl: Number(k.tekniskeFejl) || 0,
    })),
    styrker: typeof s.styrker === "string" ? s.styrker : "",
    svagheder: typeof s.svagheder === "string" ? s.svagheder : "",
    oevelse: typeof s.oevelse === "string" ? s.oevelse : "",
  };
}

/*
  Lægger "ind" (data fra hukommelsen eller en fil) oven på "grundlag" og giver
  et nyt, rent data-objekt tilbage. Felter der mangler i "ind", tages fra grundlaget.
  Ukendte roller, forkerte tal o.l. bliver sorteret fra, så appen aldrig går ned.
*/
export function normaliser(ind, grundlag) {
  const d = structuredClone(grundlag);
  if (!ind || typeof ind !== "object") {
    d.spillere = d.spillere.map(sikrSpiller);   // også standardspillerne skal have alle felter
    return d;
  }

  if (Array.isArray(ind.spillere)) {
    d.spillere = ind.spillere
      .filter(s => s && typeof s.id === "number" && ROLLER[s.rolle])
      .map(sikrSpiller);
  } else {
    d.spillere = d.spillere.map(sikrSpiller);
  }
  const findes = id => d.spillere.some(s => s.id === id);

  if (ind.opstilling) {
    for (const plads in d.opstilling) {
      const id = ind.opstilling[plads];
      d.opstilling[plads] = findes(id) ? id : null;     // kun spillere der stadig findes
    }
  }
  if (ind.pladsPositioner) {
    for (const rolle in d.pladsPositioner) {
      const p = ind.pladsPositioner[rolle];
      if (p && typeof p.x === "number" && typeof p.y === "number") d.pladsPositioner[rolle] = p;
    }
  }
  if (ind.modstander && Array.isArray(ind.modstander.positioner)) {
    d.modstander = { formation: ind.modstander.formation || "", positioner: ind.modstander.positioner };
  }
  if (Array.isArray(ind.systemer)) {
    d.systemer = ind.systemer.filter(s => s && Array.isArray(s.trin) && s.trin.length > 0);
  }
  if (Array.isArray(ind.modstandere)) {
    d.modstandere = ind.modstandere
      .filter(h => h && typeof h === "object")
      .map(h => ({
        navn: "", forsvar: "", styrker: "", opmaerksom: "", noter: "",
        ...h,
        noeglespillere: (Array.isArray(h.noeglespillere) ? h.noeglespillere : [])
          .filter(sp => sp && typeof sp === "object")
          .map(sp => ({ ...sp, nummer: Number(sp.nummer) || 0 })),
      }));
  }
  if (Array.isArray(ind.opstillinger)) d.opstillinger = ind.opstillinger;
  if (Array.isArray(ind.tegning)) d.tegning = ind.tegning;
  if (ind.kampdag && Array.isArray(ind.kampdag.haendelser)) d.kampdag = { ...nyKampdag(), ...ind.kampdag };
  return d;
}

// Hent data fra browserens hukommelse (eller standarddata første gang)
export function hentData() {
  try {
    const tekst = localStorage.getItem(LAGER_NOEGLE);
    if (tekst) return normaliser(JSON.parse(tekst), standardData());
  } catch (fejl) {
    console.warn("Kunne ikke hente gemte data:", fejl);
  }
  return normaliser(null, standardData());
}

// Gem data i browserens hukommelse
export function gemData(data) {
  try {
    localStorage.setItem(LAGER_NOEGLE, JSON.stringify(data));
  } catch (fejl) {
    console.warn("Kunne ikke gemme data:", fejl);
  }
}
