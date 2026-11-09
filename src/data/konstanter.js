/*
  KONSTANTER – ting der aldrig ændrer sig, mens appen kører.
  "export" betyder, at andre filer kan hente dem med "import".
*/

// Navnet appen gemmer sine data under i browserens hukommelse (localStorage)
export const LAGER_NOEGLE = "playmaker-data";

// Alle roller. Nøglen (fx "VB") er en kort kode, vi bruger overalt i koden.
export const ROLLER = {
  MV: { navn: "Målmand",            farve: "#facc15", tekst: "#1e1e1e" },
  VF: { navn: "Venstre fløj",       farve: "#22c55e", tekst: "#ffffff" },
  VB: { navn: "Venstre back",       farve: "#3b82f6", tekst: "#ffffff" },
  C:  { navn: "Center (playmaker)", farve: "#a855f7", tekst: "#ffffff" },
  HB: { navn: "Højre back",         farve: "#f97316", tekst: "#ffffff" },
  HF: { navn: "Højre fløj",         farve: "#14b8a6", tekst: "#ffffff" },
  ST: { navn: "Stregspiller",       farve: "#ef4444", tekst: "#ffffff" },
};

// Rollernes rækkefølge (bruges til sortering)
export const ROLLE_RAEKKEFOELGE = Object.keys(ROLLER);

// Vores 6 markspillere (uden målmand) – dem der er med i systemerne
export const ANGRIBERE = ["VF", "VB", "C", "HB", "HF", "ST"];

/*
  EKSTRA ROLLER – kun til systemer, ikke til spillerne på holdet.
  "ST2" er en ekstra stregspiller, når vi spiller 7 mod 6 (tomt mål).
  Han låner stregspillerens farve. Han står IKKE i ROLLER, for så ville man kunne
  vælge "ST2" som position for en spiller – og det giver ikke mening.
*/
export const EKSTRA_ROLLER = {
  ST2: { ...ROLLER.ST, navn: "Stregspiller 2" },
};

// Alle angriber-pladser, der kan være i et system (den 7. bruges kun, hvis den er med)
export const ALLE_ANGRIBERE = [...ANGRIBERE, "ST2"];

/*
  De 7 faste pladser på taktiktavlen. x og y er i banens koordinater:
  banen går fra (0,0) til (200,200), 1 enhed = 10 cm. Målet vi angriber står øverst.
*/
export const PLADSER = [
  { rolle: "MV", x: 100, y: 186 },  // foran vores EGET mål nederst
  { rolle: "VF", x: 14,  y: 26 },   // ude i venstre hjørne
  { rolle: "HF", x: 186, y: 26 },   // ude i højre hjørne
  { rolle: "ST", x: 100, y: 76 },   // på stregen, lige uden for 6 m
  { rolle: "VB", x: 42,  y: 112 },  // bag 9 m i venstre side
  { rolle: "HB", x: 158, y: 112 },  // bag 9 m i højre side
  { rolle: "C",  x: 100, y: 128 },  // midt på, bag 9 m
];

// Banetegningens viewBox (skal passe med <svg viewBox="-15 -30 230 252"> i BaneSVG)
export const VIEWBOX = { x: -15, y: -30, bredde: 230, hoejde: 252 };

/*
  MODSTANDERENS FORSVAR: 6 forsvarsspillere [x, y] pr. formation.
  Navnet betyder: hvor mange står på 6 m – hvor mange længere fremme.
*/
export const FORSVAR = {
  "6-0":   [[20, 38], [50, 60], [78, 66], [122, 66], [150, 60], [180, 38]],
  "5-1":   [[18, 36], [48, 60], [100, 55], [152, 60], [182, 36], [100, 100]],
  "3-2-1": [[32, 48], [100, 55], [168, 48], [62, 86], [138, 86], [100, 100]],
};
export const MODSTANDER_MV = [100, 12];           // modstandernes målmand i målet øverst

// Farver på trøjerne
export const MODSTANDER_FARVE = "#1f2937";        // mørk trøje
export const MODSTANDER_KANT = "#f87171";         // rød kant
export const MODSTANDER_MV_FARVE = "#7f1d1d";     // modstandernes målmand: mørkerød
export const HJEMME = {
  mark:     { farve: "#facc15", tekst: "#1e1e1e", langaermet: false },   // gul
  maalmand: { farve: "#9ca3af", tekst: "#111827", langaermet: true },    // grå, lange ærmer
};

// Målets kasse i banens koordinater (bruges til at se, om bolden er i målet = skud)
export const MAAL = { venstre: 85, hoejre: 115, top: -10, bund: 0 };

// Knapperne man kan trykke på ved hver spiller på Kampdag
export const KAMP_HANDLINGER = {
  maal:   { ikon: "⚽", navn: "Mål",        felt: "maal" },
  assist: { ikon: "🅰️", navn: "Assist",     felt: "assists" },
  afb:    { ikon: "❌", navn: "Afbrænder",  felt: "afbraendere" },
  fejl:   { ikon: "⚠️", navn: "Tekn. fejl", felt: "tekniskeFejl" },
  udv:    { ikon: "⏱", navn: "2 min",       felt: "udvisninger" },
};
