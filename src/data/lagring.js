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
  Sørger for at et systems forgrening (varianter, se systemVarianter.js) er i orden:
    - forgrening skal være et objekt med en liste "varianter"
    - en variant skal være et objekt med en trinliste med mindst ét trin
    - der skal være 2-4 gyldige varianter – ellers fjernes forgreningen helt
  Gamle systemer uden forgrening kommer uændret igennem.
*/
export function sikrForgrening(s) {
  if (!("forgrening" in s)) return s;
  const f = s.forgrening;
  const brugteIder = new Set();
  const varianter = (f && typeof f === "object" && Array.isArray(f.varianter) ? f.varianter : [])
    .filter(v => v && typeof v === "object" && Array.isArray(v.trin) && v.trin.length > 0)
    .slice(0, 4)                                          // højst 4 varianter
    .map((v, i) => {
      // Id'et skal være tekst (det sammenlignes med værdien fra en <select>, som altid er tekst).
      // Mangler det (eller er det brugt før), laver vi et nyt – id'erne skal være unikke.
      const id = v.id != null && !brugteIder.has(String(v.id)) ? String(v.id) : `v${i}-${Date.now()}`;
      brugteIder.add(id);
      return { ...v, id, navn: String(v.navn ?? "") };
    });
  const kopi = { ...s };
  if (varianter.length < 2) {
    delete kopi.forgrening;                               // ugyldig → bare et almindeligt system
  } else {
    kopi.forgrening = { spoergsmaal: String(f.spoergsmaal ?? ""), varianter };
  }
  return kopi;
}

/*
  Sørger for at et helt system er i orden:
    - type er "angreb" eller "forsvar" (mangler den – fx i gamle systemer – er det "angreb")
    - skabelon er true eller false (true = kom fra skabelonerne, se skabeloner.js)
    - forgreningen tjekkes af sikrForgrening
*/
export function sikrSystem(s) {
  return {
    ...sikrForgrening(s),
    type: s.type === "forsvar" ? "forsvar" : "angreb",
    skabelon: s.skabelon === true,
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
    d.systemer = d.systemer.map(sikrSystem);
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
    d.systemer = ind.systemer
      .filter(s => s && Array.isArray(s.trin) && s.trin.length > 0)
      .map(sikrSystem);
  } else {
    d.systemer = d.systemer.map(sikrSystem);     // også standardsystemerne skal have type og skabelon
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
