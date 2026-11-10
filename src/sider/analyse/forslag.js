/*
  FORSLAG – den indbyggede "AI": regler, der læser jeres systemer, statistik og
  modstanderens forsvar og giver gode råd. Ingen internet, intet API – alt sker i appen.

  To dele:
    1) rangerSystemer(): hvilke af JERES systemer passer bedst mod forsvaret – og hvorfor
    2) forbedringer():   hvad holdet kan gøre bedre (ud fra statistik, skudkort og systemerne)

  Rene funktioner – de ændrer aldrig data.
*/
import { kendetegn, zoneBrug, ZONER, angrebssystemer } from "./heatmap.js";
import { kampeAf, spillerTotaler, holdKampe, udfald } from "../statistik/beregning.js";
import { laegSkudKortSammen, hjoerneNavn, HJOERNE_NOEGLER } from "../kampdag/maalHjoerner.js";
import { decimal } from "../../hjaelpere.js";

/*
  HÅNDBOLD-VIDEN: hvad virker typisk mod hvert forsvar?
  vaegte: hvor mange point et system får for hvert kendetegn.
  tips: generelle råd, der vises øverst.
*/
export const FORSVARS_VIDEN = {
  "6-0": {
    navn: "6-0",
    beskrivelse: "Alle seks står på 6 m. Stærkt mod gennembrud, men giver plads til skud fra 9 m og spil i bredden.",
    vaegte: { krydsning: 3, spaerring: 3, skudBack: 2, floejSpil: 2, stregSpil: 1, syvModSeks: 1 },
    tips: [
      "Skyd fra 9 m – forsvaret står dybt, så backs får tid og plads.",
      "Krydsninger flytter forsvarerne sidelæns og åbner huller mellem 2'eren og 3'eren.",
      "Brug stregspilleren til at spærre for backskuddet.",
      "Hurtig boldomgang ud til fløjene trækker forsvaret bredt.",
    ],
  },
  "5-1": {
    navn: "5-1",
    beskrivelse: "Fem på 6 m og én fremskudt foran midten. Den fremskudte forstyrrer centeren, men efterlader plads bag sig.",
    vaegte: { stregSpil: 3, krydsning: 2, skudMidt: 2, floejSpil: 2, spaerring: 2, syvModSeks: 1 },
    tips: [
      "Spil bolden ind på stregen BAG den fremskudte – der er hul mellem ham og 6 m-linjen.",
      "Lad centeren trække den fremskudte væk og spil videre til backen ved siden af.",
      "Krydsning mellem C og back gør det svært for den fremskudte at vælge mand.",
      "En fløj, der løber ind som 2. stregspiller, giver overtal på 6 m.",
    ],
  },
  "3-2-1": {
    navn: "3-2-1",
    beskrivelse: "Et offensivt forsvar i tre rækker. Godt mod skud fra 9 m, men åbent i dybden og ude på fløjene.",
    vaegte: { floejSpil: 3, stregSpil: 3, gennembrud: 2, syvModSeks: 2, krydsning: 1 },
    tips: [
      "Lange afleveringer ud til fløjene – forsvaret kan ikke nå at dække bredden.",
      "Spil med to på stregen (fløj ind eller 7 mod 6): der er masser af plads i dybden.",
      "Gå 1 mod 1 – forsvarerne står højt, så et godt gennembrud giver frit skud.",
      "Hold afstanden: korte afleveringer tæt på forsvaret bliver opsnappet.",
    ],
  },
};

/*
  Giv hvert angrebssystem point mod forsvaret og en liste over grunde.
  Giver en sorteret liste [{ system, point, grunde: [...], kendetegn }] – bedst først.
*/
export function rangerSystemer(systemer, forsvar) {
  const viden = FORSVARS_VIDEN[forsvar];
  if (!viden) return [];
  const v = viden.vaegte;

  return angrebssystemer(systemer).map(system => {
    const k = kendetegn(system);
    const grunde = [];
    let point = 0;
    const giv = (antal, tekst) => { if (antal > 0) { point += antal; grunde.push(tekst); } };

    if (system.forsvar === forsvar) giv(3, `Lavet mod ${forsvar}-forsvar`);
    if (k.krydsning) giv(v.krydsning ?? 0, "Har en krydsning");
    if (k.spaerring) giv(v.spaerring ?? 0, "Stregspilleren spærrer/sætter skærm");
    if (k.floejSpil) giv(v.floejSpil ?? 0, "Bolden kommer ud på fløjen");
    if (k.stregSpil) giv(v.stregSpil ?? 0, "Spiller bolden ind på stregen");
    if (k.syvModSeks) giv(v.syvModSeks ?? 0, "7 mod 6 – overtal");
    if (k.skudZoner.some(z => z === "vb" || z === "hb")) giv(v.skudBack ?? 0, "Afslutter med backskud");
    if (k.skudZoner.includes("midt")) giv(v.skudMidt ?? 0, "Afslutter i midten");
    if (k.skudZoner.includes("midt") || k.skudZoner.includes("streg")) giv(v.gennembrud ?? 0, "Går i dybden mod mål");
    if (k.skudZoner.length === 0) { point -= 1; grunde.push("Ingen afslutning i systemet endnu"); }

    return { system, point, grunde, kendetegn: k };
  }).sort((a, b) => b.point - a.point);
}

// Procent med 0 decimaler som tekst
const pct = (del, helhed) => (helhed > 0 ? Math.round((del / helhed) * 100) : 0);

/*
  Hvad kan holdet gøre bedre? Giver en liste af råd:
    { ikon, titel, tekst, vigtig }   (vigtig = vises med rød/orange kant)
  modstander: det valgte modstanderhold (eller null) – forsvar: den valgte formation.
*/
export function forbedringer(data, forsvar, modstander) {
  const raad = [];
  const spillere = Array.isArray(data?.spillere) ? data.spillere : [];
  const systemer = angrebssystemer(data?.systemer);

  /* ---------- 1) Afslutninger ---------- */
  const markspillere = spillere.filter(s => s.rolle !== "MV");
  let maal = 0, afb = 0, fejl = 0;
  const kampDatoer = new Set();
  for (const s of markspillere) {
    for (const k of kampeAf(s)) {
      maal += Number(k.maal) || 0;
      afb += Number(k.afbraendere) || 0;
      fejl += Number(k.tekniskeFejl) || 0;
      kampDatoer.add(`${k.dato}|${k.modstander}`);
    }
  }
  const antalKampe = kampDatoer.size;
  if (maal + afb >= 10) {
    const skudPct = pct(maal, maal + afb);
    if (skudPct < 55) {
      raad.push({ ikon: "🎯", vigtig: true, titel: `Skudprocent: ${skudPct} %`,
        tekst: "Holdet brænder mange chancer. Spil længere efter den RIGTIGE chance (fløj eller streg tæt på mål) i stedet for svære skud fra distancen." });
    } else {
      raad.push({ ikon: "🎯", titel: `Skudprocent: ${skudPct} % – flot`,
        tekst: "Afslutningerne sidder godt. Fortsæt med at skabe de samme chancer." });
    }
  }
  if (antalKampe > 0 && fejl / antalKampe >= 8) {
    raad.push({ ikon: "⚠️", vigtig: true, titel: `${decimal(fejl / antalKampe)} tekniske fejl pr. kamp`,
      tekst: "For mange boldtab. Øv sikre afleveringer under pres og undgå lange afleveringer gennem forsvaret." });
  }

  /* ---------- 2) Spillere der brænder meget ---------- */
  const braendere = markspillere
    .map(s => ({ s, t: spillerTotaler(s) }))
    .filter(x => x.t.maal + x.t.afbraendere >= 8 && x.t.skudPct !== null && x.t.skudPct < 45)
    .sort((a, b) => a.t.skudPct - b.t.skudPct)
    .slice(0, 2);
  for (const { s, t } of braendere) {
    raad.push({ ikon: "🧍", titel: `${s.navn} (#${s.nummer}): ${Math.round(t.skudPct)} % i skud`,
      tekst: `${t.afbraendere} afbrændere på ${t.maal + t.afbraendere} skud. Giv ${s.navn} nemmere afslutninger i systemerne – eller lad en anden tage skuddet.` });
  }

  /* ---------- 3) Skudkort: hvor i målet brænder vi? ---------- */
  let kort = {};
  for (const s of markspillere) for (const k of kampeAf(s)) if (k.skudKort) kort = laegSkudKortSammen(kort, k.skudKort);
  const hjoerner = HJOERNE_NOEGLER.map(n => ({ n, ...(kort[n] ?? { maal: 0, afb: 0 }) }))
    .filter(h => h.maal + h.afb >= 4);
  if (hjoerner.length) {
    const vaerst = [...hjoerner].sort((a, b) => pct(a.maal, a.maal + a.afb) - pct(b.maal, b.maal + b.afb))[0];
    const bedst = [...hjoerner].sort((a, b) => pct(b.maal, b.maal + b.afb) - pct(a.maal, a.maal + a.afb))[0];
    if (vaerst.n !== bedst.n) {
      raad.push({ ikon: "🥅", titel: "Skyd mere mod " + hjoerneNavn(bedst.n).toLowerCase(),
        tekst: `${hjoerneNavn(bedst.n)}: ${pct(bedst.maal, bedst.maal + bedst.afb)} % mål. ` +
               `${hjoerneNavn(vaerst.n)}: kun ${pct(vaerst.maal, vaerst.maal + vaerst.afb)} %.` });
    }
  }

  /* ---------- 4) Målmænd ---------- */
  for (const mv of spillere.filter(s => s.rolle === "MV")) {
    const t = spillerTotaler(mv);
    if (t.redningPct !== null && t.redninger >= 5 && t.redningPct < 30) {
      raad.push({ ikon: "🧤", titel: `${mv.navn}: ${Math.round(t.redningPct)} % redninger`,
        tekst: "Forsvaret skal hjælpe målmanden: luk skud fra 9 m og tving modstanderen ud på dårlige vinkler." });
    }
  }

  /* ---------- 5) Systemerne: bruger vi hele banen? ---------- */
  const brug = zoneBrug(systemer);
  const iAlt = Object.values(brug.afl).reduce((a, b) => a + b, 0);
  if (systemer.length && iAlt >= 4) {
    const glemte = Object.keys(ZONER).filter(z => brug.afl[z] + brug.skud[z] === 0);
    if (glemte.length) {
      raad.push({ ikon: "🗺️", titel: "Zoner I aldrig bruger",
        tekst: `Ingen af jeres systemer spiller bolden til: ${glemte.map(z => ZONER[z].toLowerCase()).join(", ")}. ` +
               "Forsvaret lærer hurtigt, hvor I ikke kommer – lav et system, der ender der." });
    }
    const midt = brug.afl.midt + brug.afl.vb + brug.afl.hb;
    if (pct(midt, iAlt) >= 75) {
      raad.push({ ikon: "↔️", titel: "Meget spil i midten",
        tekst: `${pct(midt, iAlt)} % af afleveringerne går til backs/midt. Brug bredden – spil bolden ud på fløjene, så forsvaret bliver trukket.` });
    }
  }

  /* ---------- 6) Systemer mod netop dette forsvar ---------- */
  if (forsvar && FORSVARS_VIDEN[forsvar]) {
    const mod = systemer.filter(s => s.forsvar === forsvar).length;
    if (mod === 0) {
      raad.push({ ikon: "🧩", vigtig: true, titel: `Ingen systemer lavet mod ${forsvar}`,
        tekst: `Lav mindst ét system på Systemer-siden med ${forsvar}-forsvar, så I har øvet det før kampen.` });
    }
    const harSyvModSeks = systemer.some(s => kendetegn(s).syvModSeks);
    if (forsvar === "3-2-1" && !harSyvModSeks) {
      raad.push({ ikon: "➕", titel: "Prøv 7 mod 6",
        tekst: "Mod et offensivt 3-2-1 er en ekstra stregspiller effektiv. Der findes en skabelon på Systemer-siden." });
    }
  }

  /* ---------- 7) Tidligere kampe mod modstanderen ---------- */
  if (modstander?.navn) {
    const navn = modstander.navn.trim().toLowerCase();
    const kampe = holdKampe(data).filter(k => k.kendt && k.modstander.trim().toLowerCase() === navn);
    if (kampe.length) {
      const v = kampe.filter(k => udfald(k) === "V").length;
      const t = kampe.filter(k => udfald(k) === "T").length;
      const sidste = kampe[0];
      raad.push({ ikon: "📅", vigtig: t > v, titel: `Mod ${modstander.navn}: ${v} V · ${kampe.length - v - t} U · ${t} T`,
        tekst: `Sidste kamp (${sidste.dato}): ${sidste.hjemme}-${sidste.ude}. ` +
               (t > v ? "I har haft svært ved dem – brug forslagene herover og forbered jer ekstra." : "I plejer at klare jer godt – hold fast i det, der virker.") });
    }
    if (modstander.opmaerksom) {
      raad.push({ ikon: "👀", titel: "Vær opmærksom på (fra Oversigt)", tekst: modstander.opmaerksom });
    }
  }

  if (!raad.length) {
    raad.push({ ikon: "ℹ️", titel: "For lidt data endnu",
      tekst: "Brug Kampdag til at registrere kampe og lav nogle systemer – så kommer der flere forslag her." });
  }
  // De vigtige først
  return raad.sort((a, b) => (b.vigtig ? 1 : 0) - (a.vigtig ? 1 : 0));
}
