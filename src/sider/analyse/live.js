/*
  LIVE – simuleret heatmap og forslag UNDER kampen (ud fra Kampdag).

  Appen ved ikke præcis, hvor spillerne står. Derfor GÆTTER vi ud fra deres position:
  får Rasmus (venstre back) en teknisk fejl, går vi ud fra, at den skete i venstre back-området.
  Hver hændelse lægger en "varme-klat" i spillerens område. Heatmappet viser altså,
  hvor BOLDEN mest er, mens vi har den.

  Forslagene kigger på:
    - om spillet ligger mest i den ene side       → "få bolden over i den anden side"
    - om fløjene næsten ikke bruges                → "brug fløjene"
    - hvad du har skrevet om modstanderen (Oversigt), fx "venstre fløj dårlig i forsvar"
    - hvorfra modstanderen scorer på os (vælges på Kampdag efter "Mål til dem")
  Rene funktioner – de ændrer intet.
*/
import { CELLE, ANTAL } from "./heatmap.js";

// Hvor står hver position (vores angreb, halv bane, mål øverst)?
export const PLADS_PUNKT = {
  VF: { x: 22, y: 38 },  VB: { x: 55, y: 106 }, C: { x: 100, y: 114 },
  HB: { x: 145, y: 106 }, HF: { x: 178, y: 38 }, ST: { x: 100, y: 72 },
};
export const PLADS_NAVN = {
  VF: "venstre fløj", VB: "venstre back", C: "center", HB: "højre back", HF: "højre fløj", ST: "stregspiller",
};
// Hvilken side hører positionen til? (midten = C og ST)
const SIDE = { VF: "venstre", VB: "venstre", HB: "hoejre", HF: "hoejre" };

// Hvor meget varme hver slags hændelse giver, og hvor tæt på mål den sker (dy)
const HAENDELSE_VAEGT = {
  maal:   { vaegt: 3, dy: -14 },   // skud sker tættere på mål
  afb:    { vaegt: 3, dy: -14 },
  assist: { vaegt: 2, dy: 0 },
  fejl:   { vaegt: 2, dy: 6 },     // fejl sker ofte i opspillet, lidt længere ude
};

// Læg en blød "klat" (gauss-formet) omkring punktet p
function klat(gitter, p, vaegt, spredning = 9) {     // lille spredning = mere præcis plet
  const r = Math.ceil((spredning * 2) / CELLE);
  const cr = Math.floor(p.y / CELLE), ck = Math.floor(p.x / CELLE);
  for (let i = cr - r; i <= cr + r; i++) {
    for (let j = ck - r; j <= ck + r; j++) {
      if (i < 0 || j < 0 || i >= ANTAL || j >= ANTAL) continue;
      const dx = (j + 0.5) * CELLE - p.x, dy = (i + 0.5) * CELLE - p.y;
      gitter[i][j] += vaegt * Math.exp(-(dx * dx + dy * dy) / (2 * spredning * spredning));
    }
  }
}

// Den position, spilleren spiller på (MV tæller ikke i angrebet)
const pladsAf = s => (s && PLADS_PUNKT[s.rolle] ? s.rolle : null);

/*
  Tæl vores hændelser pr. position i en kamp: { VF: { maal, afb, assist, fejl, i_alt }, ... }
  Sekundær position får 20 % af tallet – vi ved ikke altid, hvor spilleren stod.
*/
export function haendelserPrPlads(kampdag, spillere) {
  const tom = () => ({ maal: 0, afb: 0, assist: 0, fejl: 0, iAlt: 0 });
  const ud = Object.fromEntries(Object.keys(PLADS_PUNKT).map(p => [p, tom()]));
  for (const h of kampdag?.haendelser ?? []) {
    if (!HAENDELSE_VAEGT[h.type]) continue;
    const s = spillere.find(x => x.id === h.spillerId);
    const p = pladsAf(s);
    if (!p) continue;
    const andel = s.sekundaer && PLADS_PUNKT[s.sekundaer] ? 0.8 : 1;
    ud[p][h.type] += andel; ud[p].iAlt += andel;
    if (andel < 1) { ud[s.sekundaer][h.type] += 0.2; ud[s.sekundaer].iAlt += 0.2; }
  }
  return ud;
}

/*
  Det simulerede heatmap for den igangværende kamp.
  Giver { gitter, max, antal } – samme form som bygHeatmap i heatmap.js.
*/
export function bygLiveHeatmap(kampdag, spillere) {
  const gitter = Array.from({ length: ANTAL }, () => new Array(ANTAL).fill(0));
  let antal = 0;

  // Kun hændelser hvor VI har bolden (mål, afbrænder, assist, teknisk fejl): bolden er hos spilleren.
  // Hver hændelse giver en klat i spillerens område (80 % primær, 20 % sekundær position)
  for (const h of kampdag?.haendelser ?? []) {
    const v = HAENDELSE_VAEGT[h.type];
    if (!v) continue;
    const s = spillere.find(x => x.id === h.spillerId);
    const p = pladsAf(s);
    if (!p) continue;
    const sek = s.sekundaer && PLADS_PUNKT[s.sekundaer] ? s.sekundaer : null;
    const punkt = q => ({ x: PLADS_PUNKT[q].x, y: Math.max(8, PLADS_PUNKT[q].y + v.dy) });
    klat(gitter, punkt(p), v.vaegt * (sek ? 0.8 : 1));
    if (sek) klat(gitter, punkt(sek), v.vaegt * 0.2);
    antal++;
  }
  const max = Math.max(0, ...gitter.flat());
  return { gitter, max, antal };
}

/* ---------- Hvad har du skrevet om modstanderen? ---------- */
// Ord for positioner (fra DERES synsvinkel) og ord der betyder "svag"
const POSITIONS_ORD = [
  { plads: "VF", ord: ["venstre fløj", "venstrefløj", "vf"] },
  { plads: "HF", ord: ["højre fløj", "højrefløj", "hf"] },
  { plads: "VB", ord: ["venstre back", "venstreback", "vb"] },
  { plads: "HB", ord: ["højre back", "højreback", "hb"] },
  { plads: "C",  ord: ["center", "playmaker"] },
  { plads: "ST", ord: ["stregspiller", "streg", "st"] },
  { plads: "MV", ord: ["målmand", "keeper", "mv"] },
];
const SVAG_ORD = ["dårlig", "svag", "langsom", "usikker", "lille", "lav", "doven", "træg", "hul", "skadet", "ny"];

/*
  Find svage spillere/positioner i noterne om modstanderen.
  Giver [{ plads, tekst }] – tekst = den sætning, der fandt det.
*/
export function modstanderSvagheder(modstander) {
  if (!modstander) return [];
  const tekster = [modstander.styrker, modstander.opmaerksom, modstander.noter,
    ...(modstander.noeglespillere ?? []).map(n => `${n.position ?? ""} ${n.note ?? ""} ${n.noter ?? ""}`)];
  const fundet = [];
  for (const tekst of tekster) {
    for (const saetning of String(tekst ?? "").split(/[.!?\n]+/)) {
      const lille = " " + saetning.toLowerCase() + " ";
      if (!SVAG_ORD.some(o => lille.includes(o))) continue;
      for (const { plads, ord } of POSITIONS_ORD) {
        // Korte forkortelser (vf, st ...) skal stå som hele ord
        const har = ord.some(o => (o.length <= 3 ? new RegExp(`[^a-zæøå]${o}[^a-zæøå]`).test(lille) : lille.includes(o)));
        if (har && !fundet.some(f => f.plads === plads)) fundet.push({ plads, tekst: saetning.trim() });
      }
    }
  }
  return fundet;
}

/*
  Deres spiller i forsvar står (set fra os) i den MODSATTE side af sit navn:
  deres venstre fløj forsvarer ude ved VORES højre fløj. Giver vores position.
*/
const MODSAT = { VF: "HF", VB: "HB", HF: "VF", HB: "VB", C: "C", ST: "ST" };

/* ---------- Mål imod: hvorfra scorer de? ---------- */
export const IMOD_PLADSER = ["VF", "VB", "C", "HB", "HF", "ST", "7m", "kontra"];
export const IMOD_NAVN = {
  VF: "deres venstre fløj", VB: "deres venstre back", C: "deres center", HB: "deres højre back",
  HF: "deres højre fløj", ST: "deres stregspiller", "7m": "straffekast", kontra: "kontra",
};

export function imodFordeling(haendelser) {
  const ud = {};
  for (const h of haendelser ?? []) {
    if (h.type === "modmaal" && h.skytte && IMOD_PLADSER.includes(h.skytte)) ud[h.skytte] = (ud[h.skytte] || 0) + 1;
  }
  return ud;
}

// Hvordan dækker man om, når de scorer meget fra én position?
const OMDAEKNING = {
  VB: "Gå mere offensivt ud på deres venstre back: lad 2'eren/5'eren træde tidligt frem (fx 5-1 med den fremskudte i den side), og lad blokken stå klar til skuddet.",
  HB: "Gå mere offensivt ud på deres højre back: lad 2'eren/5'eren træde tidligt frem (fx 5-1 med den fremskudte i den side), og lad blokken stå klar til skuddet.",
  C:  "Sæt en fremskudt forsvarer på deres center (5-1), så han ikke får tid til at skyde eller styre spillet.",
  ST: "Stregspilleren scorer for let: stå tættere (6-0), hold kontakt og lad 3'eren og 4'eren dække ham sammen. Undgå at gå for højt ud.",
  VF: "Deres venstre fløj scorer meget: lad yderste forsvarer stå bredere og ikke hjælpe for tidligt ind mod midten. Målmanden skal dække nærmeste stolpe.",
  HF: "Deres højre fløj scorer meget: lad yderste forsvarer stå bredere og ikke hjælpe for tidligt ind mod midten. Målmanden skal dække nærmeste stolpe.",
  "7m": "Mange straffekast: forsvaret laver for mange frispark tæt på mål. Flyt fødderne i stedet for at holde/skubbe.",
  kontra: "Mange kontramål: løb hjem med det samme efter skud/fejl, og lad én spiller (fx center) altid sikre bagud.",
};

/*
  LIVE-FORSLAG under kampen. Giver en liste: { ikon, titel, tekst, vigtig }.
*/
export function liveForslag(kampdag, spillere, modstander) {
  const haendelser = kampdag?.haendelser ?? [];
  const raad = [];
  const pr = haendelserPrPlads(kampdag, spillere);
  const sum = q => q.reduce((a, p) => a + pr[p].iAlt, 0);
  const iAlt = sum(Object.keys(PLADS_PUNKT));

  // Hvilken side står deres svage spillere i (set fra os)? Så siger side-rådet ikke det modsatte
  const svageSider = modstanderSvagheder(modstander).map(f => SIDE[MODSAT[f.plads]]).filter(Boolean);
  const menHusk = side => (svageSider.includes(side)
    ? " Men husk: deres svage spiller står i den side, I er i nu – flyt forsvaret over og spil så hurtigt tilbage til ham." : "");

  if (iAlt >= 2) {
    // 1) Side-balance
    const venstre = sum(["VF", "VB"]), hoejre = sum(["HF", "HB"]);
    const sider = venstre + hoejre;
    if (sider >= 2) {
      const andelV = venstre / sider;
      if (andelV >= 0.65) raad.push({ ikon: "➡️", vigtig: true, titel: `${Math.round(andelV * 100)} % af spillet er i venstre side`,
        tekst: "Forsvaret skubber over mod venstre. Få bolden hurtigt over i HØJRE side (HB/HF) – der er der mest plads." + menHusk("venstre") });
      if (andelV <= 0.35) raad.push({ ikon: "⬅️", vigtig: true, titel: `${Math.round((1 - andelV) * 100)} % af spillet er i højre side`,
        tekst: "Forsvaret skubber over mod højre. Få bolden hurtigt over i VENSTRE side (VB/VF) – der er der mest plads." + menHusk("hoejre") });
    }
    // 2) Fløjene
    const floej = sum(["VF", "HF"]);
    if (iAlt >= 3 && floej / iAlt < 0.2) raad.push({ ikon: "↔️", vigtig: true, titel: "Fløjene bliver næsten ikke brugt",
      tekst: `Kun ${Math.round(floej)} af ${Math.round(iAlt)} aktioner er på fløjene. Spil bolden bredt – lav en krydsning back–fløj, eller lad fløjen løbe ind som 2. streg.` });
    // 3) Mange fejl ét sted
    const fejlPlads = Object.keys(pr).sort((a, b) => pr[b].fejl - pr[a].fejl)[0];
    if (pr[fejlPlads].fejl >= 2) raad.push({ ikon: "⚠️", titel: `Mange tekniske fejl på ${PLADS_NAVN[fejlPlads]}`,
      tekst: "Gør det enkelt der: kortere afleveringer, og lad en anden tage over, hvis det fortsætter." });
    // 4) Brænder meget ét sted
    for (const p of Object.keys(pr)) {
      const skud = pr[p].maal + pr[p].afb;
      if (skud >= 2 && pr[p].afb / skud >= 0.6) raad.push({ ikon: "🎯", titel: `${PLADS_NAVN[p][0].toUpperCase() + PLADS_NAVN[p].slice(1)} brænder ${Math.round(pr[p].afb)} af ${Math.round(skud)}`,
        tekst: "Find bedre chancer – spil videre i stedet for at tage det svære skud." });
    }
  }

  // 5) Modstanderens svage spillere (fra Oversigt)
  for (const { plads, tekst } of modstanderSvagheder(modstander)) {
    if (plads === "MV") {
      raad.push({ ikon: "🥅", titel: "Deres målmand er svag ifølge dine noter", tekst: `"${tekst}" – skyd mere, også fra distancen.` });
      continue;
    }
    const vores = MODSAT[plads];
    raad.push({ ikon: "🧠", vigtig: true, titel: `Angrib deres ${PLADS_NAVN[plads]}`,
      tekst: `Du har skrevet: "${tekst}". I forsvar står han ud for vores ${PLADS_NAVN[vores]} – få bolden spillet derned og gå 1 mod 1 på ham.` });
  }

  // 6) Mål imod – hvorfra?
  const imod = imodFordeling(kampdag?.haendelser);
  const antalImod = Object.values(imod).reduce((a, b) => a + b, 0);
  if (antalImod >= 2) {
    const [top, n] = Object.entries(imod).sort((a, b) => b[1] - a[1])[0];
    if (n / antalImod >= 0.4) raad.push({ ikon: "🛡️", vigtig: true, titel: `${n} af ${antalImod} mål imod kommer fra ${IMOD_NAVN[top]}`,
      tekst: OMDAEKNING[top] });
  }

  // 7) Flere forslag ud fra kampen
  const vores = h => spillere.find(x => x.id === h.spillerId);
  const navn = s => (s ? `#${s.nummer} ${s.navn}` : "?");
  const tael = type => {
    const t = {};
    for (const h of haendelser) if (h.type === type && h.spillerId != null) t[h.spillerId] = (t[h.spillerId] || 0) + 1;
    return t;
  };
  const maal = tael("maal"), afb = tael("afb"), fejl = tael("fejl"), assist = tael("assist");

  // Varm skytte: mindst 2 mål og højst 1 afbrænder → find ham igen
  for (const id of Object.keys(maal)) {
    const m = maal[id], a = afb[id] || 0;
    if (m >= 2 && m / (m + a) >= 0.67) raad.push({ ikon: "🔥", titel: `${navn(vores({ spillerId: Number(id) }))} er varm: ${m} mål på ${m + a} skud`,
      tekst: "Bliv ved med at finde ham – lav systemer, der ender hos ham, indtil forsvaret lukker ham." });
  }
  // Spiller med mange fejl (ved navn)
  for (const id of Object.keys(fejl)) {
    if (fejl[id] >= 2) raad.push({ ikon: "🔄", titel: `${navn(vores({ spillerId: Number(id) }))} har ${fejl[id]} tekniske fejl`,
      tekst: "Overvej en kort pause på bænken, eller giv ham enklere opgaver (kort aflevering, ingen gennembrud)." });
  }
  // Playmaker: én spiller laver de fleste assists → forsvaret vil lukke ham
  const assistIAlt = Object.values(assist).reduce((x, y) => x + y, 0);
  for (const id of Object.keys(assist)) {
    if (assist[id] >= 2 && assist[id] / assistIAlt >= 0.6) raad.push({ ikon: "🅰️", titel: `${navn(vores({ spillerId: Number(id) }))} står for ${assist[id]} af ${assistIAlt} assists`,
      tekst: "Han styrer spillet godt – men forsvaret vil snart gå ud på ham. Hav en anden klar til at tage over som playmaker." });
  }
  // Center og streg: bliver de brugt?
  if (iAlt >= 4 && pr.ST.iAlt === 0) raad.push({ ikon: "📍", titel: "Stregspilleren er ikke med i spillet",
    tekst: "Ingen aktioner på stregen endnu. Spil ham ind – eller brug ham til spærringer, så backs får plads." });
  if (iAlt >= 4 && pr.C.iAlt === 0) raad.push({ ikon: "🎼", titel: "Centeren er ikke med i aktionerne",
    tekst: "Få centeren til at gå på mål en gang – så binder han midterforsvarerne og åbner for backs." });
  // Ingen skud i lang tid? (mindst 5 minutters kamptid siden sidste afslutning)
  const sidsteSkud = [...haendelser].reverse().find(h => h.type === "maal" || h.type === "afb");
  const sidsteTid = haendelser.length ? haendelser[haendelser.length - 1].sek : 0;
  if (sidsteSkud && sidsteTid - sidsteSkud.sek >= 300) raad.push({ ikon: "⏳", vigtig: true, titel: "Ingen afslutninger i over 5 minutter",
    tekst: "Angrebet går i stå. Tag et af de systemer, I er sikre i, og afslut det helt." });

  // Stillingen
  const forskel = (Number(kampdag?.hjemme) || 0) - (Number(kampdag?.ude) || 0);
  if (forskel <= -3) raad.push({ ikon: "📉", vigtig: true, titel: `I er bagud med ${-forskel}`,
    tekst: "Sæt tempoet op: hurtig midte efter deres mål og kontra. Ved 4+ i de sidste minutter: prøv 7 mod 6." });
  else if (forskel >= 3) raad.push({ ikon: "📈", titel: `I fører med ${forskel}`,
    tekst: "Spil sikkert: lange angreb, kun gode chancer, og løb hjem med det samme for at undgå kontra." });

  // Vores udvisninger lige nu
  if ((kampdag?.udvisninger ?? []).length > 0) raad.push({ ikon: "⏱", vigtig: true, titel: "I er i undertal",
    tekst: "Spil langt angreb og tag tiden ud – afslut først i en sikker chance. I forsvar: stå kompakt i 5-0 og giv dem skuddet fra distancen." });

  // Mål imod: hvilket hjørne?
  const hj = {};
  for (const h of haendelser) if (h.type === "modmaal" && h.hjoerne) hj[h.hjoerne] = (hj[h.hjoerne] || 0) + 1;
  const topHj = Object.entries(hj).sort((x, y) => y[1] - x[1])[0];
  if (topHj && topHj[1] >= 2) raad.push({ ikon: "🧤", titel: `${topHj[1]} mål imod i samme felt (${topHj[0].replace("-", " ").replace("hoej", "høj").replace("hoejre", "højre")})`,
    tekst: "Målmanden skal dække det felt bedre – og blokken skal lukke den side af, så skytten skal skyde den anden vej." });

  // Deres forsvar (fra Oversigt) – det korte råd
  const FORSVAR_KORT = {
    "6-0": "De spiller 6-0: skyd fra 9 m med skærm, og brug krydsninger til at flytte forsvaret sidelæns.",
    "5-1": "De spiller 5-1: spil bolden ind på stregen BAG den fremskudte, og lad en fløj løbe ind som 2. stregspiller.",
    "3-2-1": "De spiller 3-2-1: lange afleveringer til fløjene, gå 1 mod 1, og brug to på stregen.",
  };
  if (modstander?.forsvar && FORSVAR_KORT[modstander.forsvar]) raad.push({ ikon: "🛡️", titel: `Mod deres ${modstander.forsvar}-forsvar`, tekst: FORSVAR_KORT[modstander.forsvar] });

  // Deres gode spillere (nøglespillere fra Oversigt)
  for (const n of (modstander?.noeglespillere ?? []).slice(0, 3)) {
    raad.push({ ikon: "⭐", titel: `Pas på deres #${n.nummer} ${n.navn ?? ""}${n.position ? " (" + n.position + ")" : ""}`,
      tekst: (n.note ? n.note + " – " : "") + "gå tæt på ham i forsvar og giv ham ikke tid med bolden." });
  }

  return raad.sort((a, b) => (b.vigtig ? 1 : 0) - (a.vigtig ? 1 : 0));
}

// Find modstanderholdet fra Oversigt ud fra navnet, der står på Kampdag
export function findModstander(data, navn) {
  const n = String(navn ?? "").trim().toLowerCase();
  if (!n) return null;
  return (data.modstandere ?? []).find(h => String(h.navn ?? "").trim().toLowerCase() === n) || null;
}
