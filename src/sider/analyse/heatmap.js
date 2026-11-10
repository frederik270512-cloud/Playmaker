/*
  HEATMAP – hvor løber vi, hvor afleverer vi, og hvor skyder vi fra?

  Alt regnes ud fra SYSTEMERNE (angrebssystemerne). Rene funktioner – de ændrer intet.

  Banen (den halve, 0..200 × 0..200) deles i et gitter af små felter på CELLE × CELLE
  (10 enheder = 1 m). Hvert felt får et "varme-tal": jo flere løb/afleveringer/skud
  der går gennem feltet, jo varmere.

  Systemer på HEL bane (kontra) tæller kun med i den øverste halvdel (y 0..200),
  da det er der, angrebet foregår.
*/
import { angribereI, erForsvarssystem } from "../../systemRoller.js";
import { boldPunkt, erSkud, sammeBold } from "../../animation.js";
import { harForgrening, effektivtSystem } from "../../systemVarianter.js";

export const CELLE = 10;                       // 1 m × 1 m
export const ANTAL = 200 / CELLE;              // 20 × 20 felter

// De tre slags heatmap man kan vælge imellem
export const TYPER = {
  loeb:  { navn: "🏃 Løb",          tekst: "Hvor spillerne løber og står" },
  afl:   { navn: "🤾 Afleveringer", tekst: "Hvor bolden bliver spillet" },
  skud:  { navn: "🎯 Skud",         tekst: "Hvor afslutningerne kommer fra" },
};

/*
  ZONER – angrebet delt i 6 områder (bruges til forslagene).
  Fløjene er de yderste, stregen er tæt på 6 m, resten er backs/midt bag 9 m.
*/
export const ZONER = {
  vf:    "Venstre fløj",
  vb:    "Venstre back",
  midt:  "Midten",
  hb:    "Højre back",
  hf:    "Højre fløj",
  streg: "Stregen",
};

export function zoneAf(p) {
  if (p.x < 30) return "vf";
  if (p.x > 170) return "hf";
  if (p.y < 72) return "streg";                // tæt på 6 m (6 m-linjen er y = 60 i midten)
  if (p.x < 75) return "vb";
  if (p.x > 125) return "hb";
  return "midt";
}

// Et tomt gitter: ANTAL × ANTAL nuller
function tomtGitter() {
  return Array.from({ length: ANTAL }, () => new Array(ANTAL).fill(0));
}

// Læg "vaegt" i feltet, som punktet p ligger i (punkter uden for den halve bane springes over)
function tilfoej(gitter, p, vaegt) {
  if (!p || p.x < 0 || p.x >= 200 || p.y < 0 || p.y >= 200) return;
  gitter[Math.floor(p.y / CELLE)][Math.floor(p.x / CELLE)] += vaegt;
}

// Læg varme langs en streg fra a til b (et punkt for hver 3. enhed)
function tilfoejStreg(gitter, a, b, vaegt) {
  const laengde = Math.hypot(b.x - a.x, b.y - a.y);
  const skridt = Math.max(1, Math.round(laengde / 3));
  for (let i = 0; i <= skridt; i++) {
    const t = i / skridt;
    tilfoej(gitter, { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, vaegt / (skridt + 1) * 4);
  }
}

/*
  Alle de "tidslinjer" et system har: uden forgrening er det én (system.trin),
  med forgrening er det én pr. variant. Hver får vægt 1/antal, så et system med
  4 varianter ikke tæller 4 gange så meget som et almindeligt.
*/
export function tidslinjer(system) {
  if (!harForgrening(system)) return [{ trin: system.trin, vaegt: 1 }];
  const v = system.forgrening.varianter;
  return v.map(variant => ({ trin: effektivtSystem(system, variant.id).trin, vaegt: 1 / v.length }));
}

// Kun angrebssystemer (heatmappet handler om vores angreb)
export function angrebssystemer(systemer) {
  return (Array.isArray(systemer) ? systemer : []).filter(s => !erForsvarssystem(s) && Array.isArray(s.trin));
}

/*
  Gennemgå ét system og kald "besoeg" for hver ting der sker:
    { slags: "staa",  p }            en angriber står et sted i et trin
    { slags: "loeb",  a, b }         en angriber løber fra a til b
    { slags: "afl",   a, b }         bolden spilles fra a til b
    { slags: "skud",  a, mod }       der skydes fra a (mod = punktet i målet)
  vaegt følger med, så varianter tæller rigtigt.
*/
export function gennemgaaSystem(system, besoeg) {
  for (const { trin, vaegt } of tidslinjer(system)) {
    trin.forEach((t, i) => {
      for (const n of angribereI(t)) besoeg({ slags: "staa", p: t.pos[n], noegle: n }, vaegt);
      const naeste = trin[i + 1];
      if (!naeste) return;
      for (const n of angribereI(t)) {
        const a = t.pos[n], b = naeste.pos[n];
        if (a && b && Math.hypot(b.x - a.x, b.y - a.y) >= 4) besoeg({ slags: "loeb", a, b, noegle: n }, vaegt);
      }
      if (!sammeBold(t.bold, naeste.bold)) {
        const a = boldPunkt(t.bold, t.pos);
        // Skud: skytten står der, hvor han står i trinet FØR skuddet (spillerne flytter sig samtidig)
        if (erSkud(naeste.bold)) {
          const skytte = typeof t.bold === "string" ? naeste.pos[t.bold] ?? t.pos[t.bold] : a;
          besoeg({ slags: "skud", a: skytte, mod: naeste.bold, noegle: typeof t.bold === "string" ? t.bold : null }, vaegt);
        } else {
          besoeg({ slags: "afl", a, b: boldPunkt(naeste.bold, naeste.pos) }, vaegt);
        }
      }
    });
  }
}

/*
  Byg heatmappet for de valgte systemer og typen ("loeb", "afl" eller "skud").
  Giver { gitter, max, antal } – max = det varmeste felt (til farveskalaen),
  antal = hvor mange løb/afleveringer/skud der talte med.
*/
export function bygHeatmap(systemer, type) {
  const gitter = tomtGitter();
  let antal = 0;
  for (const s of systemer) {
    gennemgaaSystem(s, (h, vaegt) => {
      if (type === "loeb" && h.slags === "staa") tilfoej(gitter, h.p, 0.5 * vaegt);
      if (type === "loeb" && h.slags === "loeb") { tilfoejStreg(gitter, h.a, h.b, vaegt); antal += vaegt; }
      if (type === "afl" && h.slags === "afl") {
        tilfoejStreg(gitter, h.a, h.b, 0.6 * vaegt);
        tilfoej(gitter, h.b, 2 * vaegt);               // modtagerens plads lyser mest
        antal += vaegt;
      }
      if (type === "skud" && h.slags === "skud") {
        // Skud er få – så de "smitter" også lidt af på nabofelterne
        for (const [dx, dy, v] of [[0, 0, 3], [CELLE, 0, 1], [-CELLE, 0, 1], [0, CELLE, 1], [0, -CELLE, 1]]) {
          tilfoej(gitter, { x: h.a.x + dx, y: h.a.y + dy }, v * vaegt);
        }
        antal += vaegt;
      }
    });
  }
  const max = Math.max(0, ...gitter.flat());
  return { gitter, max, antal: Math.round(antal * 10) / 10 };
}

/*
  Hvor meget bruger systemerne hver zone? Giver tællere pr. zone for
  løb (hvor løbene ender), afleveringer (hvor bolden modtages) og skud (hvorfra).
*/
export function zoneBrug(systemer) {
  const tom = () => Object.fromEntries(Object.keys(ZONER).map(z => [z, 0]));
  const brug = { loeb: tom(), afl: tom(), skud: tom() };
  for (const s of systemer) {
    gennemgaaSystem(s, (h, vaegt) => {
      if (h.slags === "loeb" && h.b.y <= 200) brug.loeb[zoneAf(h.b)] += vaegt;
      if (h.slags === "afl" && h.b.y <= 200) brug.afl[zoneAf(h.b)] += vaegt;
      if (h.slags === "skud" && h.a && h.a.y <= 200) brug.skud[zoneAf(h.a)] += vaegt;
    });
  }
  return brug;
}

/*
  Kendetegn ved ét system – bruges til at vurdere, om det passer mod et bestemt forsvar.
    krydsning:  to angribere bytter side med hinanden (den ene løber forbi den anden)
    spaerring:  stregspilleren flytter sig ud mod en back (sætter skærm)
    syvModSeks: systemet bruger en 7. angriber (ST2)
    afleveringer: antal afleveringer
    skudZone:   hvor afslutningen kommer fra (eller null)
    fløjSpil:   bolden når ud på en fløj
*/
export function kendetegn(system) {
  const k = { krydsning: false, spaerring: false, syvModSeks: false, afleveringer: 0, skudZoner: [], floejSpil: false, stregSpil: false };
  const forste = system.trin?.[0];
  if (forste?.pos?.ST2) k.syvModSeks = true;

  gennemgaaSystem(system, (h, vaegt) => {
    if (h.slags === "afl") {
      k.afleveringer += vaegt;
      const z = zoneAf(h.b);
      if (z === "vf" || z === "hf") k.floejSpil = true;
      if (z === "streg") k.stregSpil = true;
    }
    if (h.slags === "skud" && h.a) {
      const z = zoneAf(h.a);
      if (!k.skudZoner.includes(z)) k.skudZoner.push(z);
      if (z === "vf" || z === "hf") k.floejSpil = true;
      if (z === "streg") k.stregSpil = true;
    }
    if (h.slags === "loeb" && (h.noegle === "ST" || h.noegle === "ST2")) {
      // Stregspilleren flytter sig mindst 1,5 m sidelæns = skærm/spærring
      if (Math.abs(h.b.x - h.a.x) >= 15) k.spaerring = true;
    }
  });

  // Krydsning: i et løb skifter to angriberes indbyrdes rækkefølge fra venstre mod højre
  for (const { trin } of tidslinjer(system)) {
    for (let i = 0; i + 1 < trin.length && !k.krydsning; i++) {
      const fra = trin[i].pos, til = trin[i + 1].pos;
      const n = angribereI(trin[i]).filter(x => x !== "ST" && x !== "ST2" && fra[x] && til[x]);
      for (let a = 0; a < n.length && !k.krydsning; a++) {
        for (let b = a + 1; b < n.length; b++) {
          const foer = fra[n[a]].x - fra[n[b]].x;
          const efter = til[n[a]].x - til[n[b]].x;
          if (foer * efter < 0 && Math.abs(efter) >= 6) { k.krydsning = true; break; }
        }
      }
    }
  }
  k.afleveringer = Math.round(k.afleveringer);
  return k;
}
