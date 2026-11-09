/*
  MÅLETS 9 FELTER – til skudkortet ("hvor i målet gik skuddet?").

  Målet deles i 3 × 3 felter: høj/midt/lav × venstre/midt/højre,
  set fra SKYTTEN (altså som man selv ser målet, når man skyder).
  Hvert felt har en kort nøgle, fx "hoej-venstre", som vi gemmer på hændelsen.
*/

export const RAEKKER = [
  { id: "hoej", navn: "Høj" },
  { id: "midt", navn: "Midt" },
  { id: "lav",  navn: "Lav" },
];

export const KOLONNER = [
  { id: "venstre", navn: "venstre" },
  { id: "midt",    navn: "midt" },
  { id: "hoejre",  navn: "højre" },
];

// Alle 9 nøgler i læserækkefølge (øverst til venstre → nederst til højre)
export const HJOERNE_NOEGLER = RAEKKER.flatMap(r => KOLONNER.map(k => `${r.id}-${k.id}`));

// "hoej-venstre" → "Høj venstre"
export function hjoerneNavn(noegle) {
  const [r, k] = String(noegle).split("-");
  const raekke = RAEKKER.find(x => x.id === r);
  const kolonne = KOLONNER.find(x => x.id === k);
  if (!raekke || !kolonne) return "";
  return `${raekke.navn} ${kolonne.navn}`;
}

/*
  Lægger to skudkort sammen (laver et NYT objekt – ændrer ikke de gamle).
  Et skudkort ser sådan ud: { "hoej-venstre": { maal: 2, afb: 1 }, ... }
  Ukendte nøgler og mærkelige tal (fra gamle eller ødelagte data) springes over.
*/
export function laegSkudKortSammen(a, b) {
  const ud = {};
  for (const kort of [a, b]) {
    if (!kort || typeof kort !== "object") continue;
    for (const noegle of HJOERNE_NOEGLER) {
      const felt = kort[noegle];
      if (!felt) continue;
      if (!ud[noegle]) ud[noegle] = { maal: 0, afb: 0 };
      ud[noegle].maal += Number(felt.maal) || 0;
      ud[noegle].afb += Number(felt.afb) || 0;
    }
  }
  return ud;
}

// Står der overhovedet noget i skudkortet?
export function harSkudData(kort) {
  return HJOERNE_NOEGLER.some(n => kort?.[n] && ((Number(kort[n].maal) || 0) + (Number(kort[n].afb) || 0)) > 0);
}
