/*
  BEREGNINGER TIL STATISTIK-SIDEN (og personlige mål i Historik)

  Alt her er "rene" funktioner: de får data ind og giver tal tilbage – de ændrer
  aldrig noget. Derfor kan både Statistik-siden og Historik-fanen bruge dem.

  En spillers kampe ligger i spiller.kampe. Hver kamp har altid:
      dato, modstander, maal, assists, afbraendere, tekniskeFejl
  og MÅSKE (kun kampe gemt fra Kampdag):
      spilletidSek, redninger, maalImod, skudKort
  Felterne der måske mangler, tjekker vi altid med erTal(), før vi bruger dem.
*/
import { decimal, sumAf } from "../../hjaelpere.js";

// Er v et rigtigt tal? (ikke undefined, null, "", NaN ...)
export const erTal = v => typeof v === "number" && Number.isFinite(v);

// Procent (0-100), eller null hvis man ville dele med 0
const procentAf = (del, helhed) => (helhed > 0 ? (del / helhed) * 100 : null);

// En spillers kampe – trygt (gamle eller ødelagte data giver bare en tom liste)
export function kampeAf(spiller) {
  return Array.isArray(spiller?.kampe) ? spiller.kampe : [];
}

// Kampene i tidsrækkefølge: ældste først (samme dato → den der blev gemt først)
export function kampeITidsorden(kampe) {
  return [...kampe].sort((a, b) =>
    String(a.dato ?? "").localeCompare(String(b.dato ?? "")) || (Number(a.id) || 0) - (Number(b.id) || 0));
}

/*
  Alle tal for én spiller lagt sammen – bruges i topscorer-tabellen.
  Tal der ikke kan regnes ud (fx skud % uden skud), er null, så tabellen kan vise "–".
*/
export function spillerTotaler(spiller) {
  const kampe = kampeAf(spiller);
  const antal = kampe.length;
  const maal = sumAf(kampe, "maal");
  const afbraendere = sumAf(kampe, "afbraendere");

  // Spilletid og redninger tæller kun de kampe, der HAR feltet
  const medTid = kampe.filter(k => erTal(k.spilletidSek));
  const medRedninger = kampe.filter(k => erTal(k.redninger));
  const redninger = sumAf(medRedninger, "redninger");
  const maalImod = sumAf(medRedninger, "maalImod");

  return {
    kampe: antal,
    maal,
    maalPrKamp: antal ? maal / antal : null,
    assists: sumAf(kampe, "assists"),
    afbraendere,
    skudPct: procentAf(maal, maal + afbraendere),
    tekniskeFejl: sumAf(kampe, "tekniskeFejl"),
    // Spilletid i minutter pr. kamp (kun kampe med spilletid)
    spilletidMin: medTid.length ? sumAf(medTid, "spilletidSek") / medTid.length / 60 : null,
    redninger: medRedninger.length ? redninger : null,
    redningPct: medRedninger.length ? procentAf(redninger, redninger + maalImod) : null,
  };
}

/* =========================================================
   PERSONLIGE MÅL
   Et mål gemmes i data.personligeMaal som { id, spillerId, type, maal, sidsteN? }
   "type" er en af nøglerne i MAAL_TYPER herunder.
   ========================================================= */

/*
  Hver måltype ved:
    navn           – teksten i valglisten og på målet
    hoejereErBedre – true: "≥ mål"  ·  false: "≤ mål" (fx tekniske fejl)
    procent        – true hvis værdien er en procent (0-100)
    kunMaalmand    – vises kun for målmænd (eller spillere med redningsdata)
    beregn(kampe)  – den nuværende værdi ud fra kampene (null = kan ikke regnes ud endnu)
*/
export const MAAL_TYPER = {
  skudPct: {
    navn: "Skud %",
    hoejereErBedre: true,
    procent: true,
    beregn: kampe => {
      const maal = sumAf(kampe, "maal");
      return procentAf(maal, maal + sumAf(kampe, "afbraendere"));
    },
  },
  maalPrKamp: {
    navn: "Mål pr. kamp",
    hoejereErBedre: true,
    beregn: kampe => (kampe.length ? sumAf(kampe, "maal") / kampe.length : null),
  },
  assistsPrKamp: {
    navn: "Assists pr. kamp",
    hoejereErBedre: true,
    beregn: kampe => (kampe.length ? sumAf(kampe, "assists") / kampe.length : null),
  },
  fejlPrKamp: {
    navn: "Tekn. fejl pr. kamp",
    hoejereErBedre: false,                      // færre fejl er bedre!
    beregn: kampe => (kampe.length ? sumAf(kampe, "tekniskeFejl") / kampe.length : null),
  },
  redningPct: {
    navn: "Redning %",
    hoejereErBedre: true,
    procent: true,
    kunMaalmand: true,
    beregn: kampe => {
      const medRedninger = kampe.filter(k => erTal(k.redninger));
      const redninger = sumAf(medRedninger, "redninger");
      return procentAf(redninger, redninger + sumAf(medRedninger, "maalImod"));
    },
  },
};

// Kan spilleren få et mål af denne type? (Redning % kun for målmænd eller spillere med redninger)
export function typePasserTilSpiller(type, spiller) {
  const t = MAAL_TYPER[type];
  if (!t) return false;
  if (!t.kunMaalmand) return true;
  return spiller?.rolle === "MV" || kampeAf(spiller).some(k => erTal(k.redninger));
}

// En værdi som tekst: procenter uden decimaler ("48%"), andet med én decimal ("2,5")
export function formatVaerdi(type, vaerdi) {
  if (!erTal(vaerdi)) return "–";
  return MAAL_TYPER[type]?.procent ? Math.round(vaerdi) + "%" : decimal(vaerdi);
}

// Selve målet som tekst, fx "Skud % ≥ 55%" eller "Tekn. fejl pr. kamp ≤ 1"
export function maalTekst(m) {
  const t = MAAL_TYPER[m.type];
  if (!t) return "Ukendt mål";
  const tegn = t.hoejereErBedre ? "≥" : "≤";
  // Målet vises uden unødvendige decimaler: 3 → "3", 2.5 → "2,5"
  const tal = String(Number(m.maal) || 0).replace(".", ",");
  return `${t.navn} ${tegn} ${tal}${t.procent ? "%" : ""}`;
}

/*
  Hvor langt er spilleren fra sit mål?
  Giver { vaerdi, procent, naaet, antalKampe } tilbage:
    vaerdi     – spillerens tal lige nu (null hvis det ikke kan regnes ud)
    procent    – hvor meget af bjælken der skal fyldes (0-100)
    naaet      – true når målet er nået
    antalKampe – hvor mange kampe der er regnet med
*/
export function maalFremskridt(m, spiller) {
  const t = MAAL_TYPER[m.type];
  let kampe = kampeITidsorden(kampeAf(spiller));
  const sidsteN = Number(m.sidsteN);
  if (Number.isInteger(sidsteN) && sidsteN > 0) kampe = kampe.slice(-sidsteN);   // kun de seneste N kampe

  const vaerdi = t && kampe.length ? t.beregn(kampe) : null;
  const maal = Math.max(0, Number(m.maal) || 0);
  if (!erTal(vaerdi)) return { vaerdi: null, procent: 0, naaet: false, antalKampe: kampe.length };

  let naaet, procent;
  if (t.hoejereErBedre) {
    naaet = vaerdi >= maal;
    procent = maal > 0 ? (vaerdi / maal) * 100 : 100;
  } else {
    // "Højst X": er man under målet, er bjælken fuld. Er man over, fyldes den mindre jo længere over.
    naaet = vaerdi <= maal;
    procent = naaet ? 100 : maal > 0 ? (maal / vaerdi) * 100 : 0;
  }
  return { vaerdi, procent: Math.min(100, Math.max(0, procent)), naaet, antalKampe: kampe.length };
}

/* =========================================================
   GRAFEN "UDVIKLING OVER TID"
   Hver måling giver ét tal pr. kamp (eller null hvis kampen ikke har dataene).
   type: "soejle" (antal – søjler) eller "linje" (procent/tid – en linje)
   ========================================================= */
export const GRAF_MAALINGER = {
  maal:         { navn: "Mål",        type: "soejle", vaerdi: k => Number(k.maal) || 0, format: v => String(v) },
  assists:      { navn: "Assists",    type: "soejle", vaerdi: k => Number(k.assists) || 0, format: v => String(v) },
  skudPct:      {
    navn: "Skud %", type: "linje", procent: true,
    vaerdi: k => procentAf(Number(k.maal) || 0, (Number(k.maal) || 0) + (Number(k.afbraendere) || 0)),
    format: v => Math.round(v) + "%",
  },
  tekniskeFejl: { navn: "Tekn. fejl", type: "soejle", vaerdi: k => Number(k.tekniskeFejl) || 0, format: v => String(v) },
  spilletid:    {
    navn: "Spilletid", type: "linje", kraever: "spilletidSek",
    vaerdi: k => (erTal(k.spilletidSek) ? k.spilletidSek / 60 : null),
    format: v => Math.round(v) + " min",
  },
  redningPct:   {
    navn: "Redning %", type: "linje", procent: true, kraever: "redninger",
    vaerdi: k => (erTal(k.redninger) ? procentAf(k.redninger, k.redninger + (Number(k.maalImod) || 0)) : null),
    format: v => Math.round(v) + "%",
  },
};

// De målinger der giver mening for spilleren (spilletid/redning % kun hvis der er data)
export function muligeMaalinger(spiller) {
  const kampe = kampeAf(spiller);
  return Object.keys(GRAF_MAALINGER).filter(noegle => {
    const felt = GRAF_MAALINGER[noegle].kraever;
    return !felt || kampe.some(k => erTal(k[felt]));
  });
}

/* =========================================================
   HOLDETS RESULTATER
   ========================================================= */

// Nøgle der samler "samme kamp": dato + modstander (uden store/små bogstaver og mellemrum)
const kampNoegle = (dato, modstander) => `${dato ?? ""}|${String(modstander ?? "").trim().toLowerCase()}`;

/*
  Alle holdets kampe, nyeste først. To kilder:
    1. data.kampResultater – kampe afsluttet på Kampdag. Her kender vi stillingen.
    2. Spillernes egne kampe (fx gamle eller manuelt tilføjede), samlet pr. dato + modstander.
       Dem bruger vi kun, hvis der IKKE er et resultat for samme dato og modstander.
       Her kender vi kun vores mål (summen af spillernes mål) – ikke modstanderens.

  Hver kamp: { noegle, dato, modstander, kendt, hjemme, ude, voresMaal }
*/
export function holdKampe(data) {
  const resultater = (Array.isArray(data?.kampResultater) ? data.kampResultater : [])
    .filter(r => r && typeof r === "object");
  const kendteNoegler = new Set(resultater.map(r => kampNoegle(r.dato, r.modstander)));

  const liste = resultater.map(r => ({
    noegle: "r" + (r.id ?? kampNoegle(r.dato, r.modstander)),
    dato: String(r.dato ?? ""),
    modstander: String(r.modstander ?? ""),
    kendt: true,
    hjemme: Number(r.hjemme) || 0,
    ude: Number(r.ude) || 0,
  }));

  // Saml spillernes kampe pr. dato + modstander
  const udledte = {};
  for (const spiller of Array.isArray(data?.spillere) ? data.spillere : []) {
    for (const k of kampeAf(spiller)) {
      const noegle = kampNoegle(k.dato, k.modstander);
      if (kendteNoegler.has(noegle)) continue;          // der er allerede et rigtigt resultat
      if (!udledte[noegle]) {
        udledte[noegle] = { noegle: "s" + noegle, dato: String(k.dato ?? ""), modstander: String(k.modstander ?? ""), kendt: false, voresMaal: 0 };
      }
      udledte[noegle].voresMaal += Number(k.maal) || 0;
    }
  }

  return [...liste, ...Object.values(udledte)].sort((a, b) => b.dato.localeCompare(a.dato));
}

// "V", "U" eller "T" for en kamp med kendt resultat
export function udfald(kamp) {
  if (kamp.hjemme > kamp.ude) return "V";
  if (kamp.hjemme < kamp.ude) return "T";
  return "U";
}
