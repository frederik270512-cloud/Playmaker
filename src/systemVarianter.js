/*
  VARIANTER (FORGRENING) AF ET SYSTEM – små "rene" hjælpefunktioner.
  "Ren" betyder: funktionen ændrer ALDRIG det system, den får. Den giver et nyt tilbage.

  Et system KAN have én forgrening. Så ser det sådan ud:

    system.trin = de FÆLLES trin (1, 2, 3 ...), som altid spilles først
    system.forgrening = {
      spoergsmaal: "Træder 2'eren ud?",
      varianter: [                                  // 2-4 varianter
        { id, navn: "Ja – aflever til fløjen", trin: [ ...trin ] },
        { id, navn: "Nej – C går selv",        trin: [ ...trin ] },
      ],
    }

  Har systemet ingen forgrening (forgrening mangler eller er null), er det et helt
  almindeligt system – præcis som før.

  Når vi tegner eller afspiller, sætter vi de fælles trin og den valgte variants trin
  sammen til ÉN lang liste: det "effektive" system. Så kan al tegne- og animationskoden
  (tilstandVed, TrinPile, MiniBane ...) bruges uændret – den kender kun system.trin.
*/

// Varianterne hedder A, B, C og D (index 0-3)
export const VARIANT_BOGSTAVER = ["A", "B", "C", "D"];
export const MIN_VARIANTER = 2;
export const MAX_VARIANTER = 4;

// Har systemet en (gyldig) forgrening?
export function harForgrening(system) {
  const varianter = system?.forgrening?.varianter;
  return Array.isArray(varianter) && varianter.length >= MIN_VARIANTER;
}

// Et nyt, unikt id til en variant (tid + lidt tilfældighed, fx "lx3k9a7f2")
export function nytVariantId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/*
  Hvilket nummer (0, 1, 2 ...) har varianten med dette id?
  Findes id'et ikke (fx efter en sletning), bruger vi den første variant (0).
  Har systemet ingen forgrening, giver vi -1.
*/
export function variantIndexAf(system, variantId) {
  if (!harForgrening(system)) return -1;
  const i = system.forgrening.varianter.findIndex(v => v.id === variantId);
  return i >= 0 ? i : 0;
}

// Selve varianten (objektet) – eller null hvis systemet ingen forgrening har
export function findVariant(system, variantId) {
  const i = variantIndexAf(system, variantId);
  return i >= 0 ? system.forgrening.varianter[i] : null;
}

/*
  Det "effektive" system: fælles trin + den valgte variants trin i én liste.
  Uden forgrening får man det SAMME objekt tilbage – så alt opfører sig som før.
*/
export function effektivtSystem(system, variantId) {
  if (!system || !harForgrening(system)) return system;
  const variant = findVariant(system, variantId);
  return { ...system, trin: [...system.trin, ...(variant?.trin ?? [])] };
}

/*
  Hvilken DEL af systemet hører trin nummer "index" (på den lange, effektive tidslinje) til?
    { del: "faelles", i }                  → system.trin[i]
    { del: "variant", variantIndex, i }    → varianten nr. variantIndex, dens trin[i]
  Giver null, hvis index ligger uden for tidslinjen.
*/
export function delAfIndex(system, variantId, index) {
  if (index === null || index < 0) return null;
  if (index < system.trin.length) return { del: "faelles", i: index };
  const variantIndex = variantIndexAf(system, variantId);
  if (variantIndex < 0) return null;
  const i = index - system.trin.length;
  if (i >= system.forgrening.varianter[variantIndex].trin.length) return null;
  return { del: "variant", variantIndex, i };
}

// Trinlisten for en del (se delAfIndex)
export function trinIDel(system, del) {
  return del.del === "faelles" ? system.trin : system.forgrening.varianter[del.variantIndex].trin;
}

/*
  Lav et NYT system, hvor trinlisten i én del er skiftet ud.
  fn får den gamle liste og giver en ny liste tilbage.
  Giver fn den samme liste tilbage (intet ændret), får man det samme system tilbage.
*/
export function aendrDel(system, del, fn) {
  const gammel = trinIDel(system, del);
  const ny = fn(gammel);
  if (ny === gammel) return system;
  if (del.del === "faelles") return { ...system, trin: ny };
  return {
    ...system,
    forgrening: {
      ...system.forgrening,
      varianter: system.forgrening.varianter.map((v, i) => (i === del.variantIndex ? { ...v, trin: ny } : v)),
    },
  };
}

/*
  Navnet på et trin, som det står på knapperne og skiltet:
    fælles trin  → "3"
    variant-trin → "4A" (nummeret på tidslinjen + variantens bogstav)
*/
export function trinNavn(system, variantId, index) {
  const del = delAfIndex(system, variantId, index);
  if (!del || del.del === "faelles") return String(index + 1);
  return `${index + 1}${VARIANT_BOGSTAVER[del.variantIndex] ?? ""}`;
}

// Hvor mange trin har systemet i alt (fælles + alle varianter)?
export function antalTrinIalt(system) {
  if (!harForgrening(system)) return system.trin.length;
  return system.trin.length + system.forgrening.varianter.reduce((sum, v) => sum + v.trin.length, 0);
}

// En kopi af et trin med tom tekst (teksten skal man selv skrive til det nye trin)
function kopiUdenTekst(trin) {
  return { ...structuredClone(trin), tekst: "" };
}

/*
  Del systemet EFTER trin nr. "efterIndex" (0 = trin 1):
    - trin 1 ... efterIndex+1 bliver de fælles trin
    - trinene efter bliver "Variant A"
    - "Variant B" starter som en kopi af det trin, man delte ved
  Er det sidste trin valgt (ingen trin efter), får variant A også en kopi.
*/
export function opretForgrening(system, efterIndex) {
  if (harForgrening(system) || efterIndex < 0 || efterIndex >= system.trin.length) return system;
  const faelles = system.trin.slice(0, efterIndex + 1);
  const resten = system.trin.slice(efterIndex + 1);
  const delTrin = system.trin[efterIndex];
  return {
    ...system,
    trin: faelles,
    forgrening: {
      spoergsmaal: "Hvad gør forsvaret?",
      varianter: [
        { id: nytVariantId(), navn: "Variant A", trin: resten.length > 0 ? resten : [kopiUdenTekst(delTrin)] },
        { id: nytVariantId(), navn: "Variant B", trin: [kopiUdenTekst(delTrin)] },
      ],
    },
  };
}

/*
  Tilføj en ny variant (højst 4). Den starter som en kopi af det sidste fælles trin.
  id kan gives med udefra – så ved den, der kalder, hvilket id den nye variant fik.
*/
export function tilfoejVariant(system, id = nytVariantId()) {
  if (!harForgrening(system) || system.forgrening.varianter.length >= MAX_VARIANTER) return system;
  const nr = system.forgrening.varianter.length;
  const ny = {
    id,
    navn: "Variant " + VARIANT_BOGSTAVER[nr],
    trin: [kopiUdenTekst(system.trin[system.trin.length - 1])],
  };
  return { ...system, forgrening: { ...system.forgrening, varianter: [...system.forgrening.varianter, ny] } };
}

// Slet en variant – men aldrig så der bliver færre end 2 (brug så fjernForgrening)
export function sletVariant(system, variantId) {
  if (!harForgrening(system) || system.forgrening.varianter.length <= MIN_VARIANTER) return system;
  return {
    ...system,
    forgrening: { ...system.forgrening, varianter: system.forgrening.varianter.filter(v => v.id !== variantId) },
  };
}

/*
  Fjern forgreningen: den variant man vil BEHOLDE, sættes bag på de fælles trin,
  og resten af varianterne forsvinder. Bagefter er det et helt almindeligt system.
*/
export function fjernForgrening(system, beholdVariantId) {
  if (!system.forgrening) return system;
  const variant = findVariant(system, beholdVariantId);
  // Et NYT objekt (så det gamle system er urørt) – og på det nye sletter vi feltet "forgrening"
  const nyt = { ...system, trin: [...system.trin, ...(variant?.trin ?? [])] };
  delete nyt.forgrening;
  return nyt;
}
