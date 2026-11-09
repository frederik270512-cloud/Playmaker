/*
  SYSTEM-EDITOR – ét åbent system. Har to tilstande:

    SEER (kladde === null):    man kan kun se og afspille systemet. Ingen panel til højre.
    REDIGER (kladde !== null): man kan flytte spillere, optage trin osv. Panel til højre.

  HVORFOR EN LOKAL ARBEJDSKOPI ("kladde")?
  Når man trykker "✏️ Rediger", laver vi en kopi af systemet og lægger den i komponentens
  egen state (useState). ALLE ændringer (træk, trin, bold, navn ...) sker kun i kopien.
  Først når man trykker "💾 Gem system" (eller Ctrl+S), skrives kopien ind i appens data
  med opdater(). Trykker man "Kassér", smider vi bare kopien væk – de gemte data er urørte.
  Et nyt system, der aldrig er gemt, kommer først ind i data.systemer, når man gemmer det.
  Fordel: mens man trækker en brik, er det kun den lille kopi, der ændres – ikke hele appen.

  Props:
    systemId    – id på systemet
    nytSystem   – et helt nyt (ikke gemt) system, eller null hvis det er et gemt system
    onLuk()     – gå tilbage til oversigten

  VARIANTER (forgrening, se systemVarianter.js):
  Et system kan dele sig efter ét trin i 2-4 varianter. Vi viser og redigerer altid den
  "effektive" tidslinje = de fælles trin + den AKTIVE variants trin. Trin nr. "index" på
  tidslinjen kan derfor ligge enten i de fælles trin eller i den aktive variant –
  delAfIndex() finder ud af hvilken, så ændringen havner det rigtige sted.

  HEL BANE: et system med helBane: true vises på hele banen (kontra/omstilling, se helBane.js).
  🎬 GEM SOM VIDEO: optager den effektive tidslinje som en .webm-fil (se videoEksport.js).
*/
import { Fragment, useEffect, useRef, useState } from "react";
import { useData } from "../../DataKontekst.jsx";
import { useDialog } from "../../komponenter/Dialog.jsx";
import { useNavigation } from "../../Navigation.jsx";
import { startPositioner } from "../../data/standardData.js";
import {
  VARIANT_BOGSTAVER, MIN_VARIANTER, MAX_VARIANTER,
  harForgrening, findVariant, effektivtSystem, delAfIndex, trinIDel, aendrDel, trinNavn,
  antalTrinIalt, nytVariantId, opretForgrening, tilfoejVariant, sletVariant, fjernForgrening,
} from "../../systemVarianter.js";
import useAfspilning from "./useAfspilning.js";
import SystemBane from "./SystemBane.jsx";
import Quiz from "./Quiz.jsx";
import { erForsvarssystem } from "../../systemRoller.js";
import { skiftBane, brugerNederstePart } from "./helBane.js";
import { videoFormat, optagVideo, videoFilnavn, hentFil } from "./videoEksport.js";

// Det samme spørgsmål bruges ved "← Alle systemer", "✓ Færdig" og skift af fane
const FORLAD_KNAPPER = [
  { tekst: "Bliv her", svar: null },
  { tekst: "Kassér", svar: "kasser", stil: "knap-fare" },
  { tekst: "💾 Gem", svar: "gem", stil: "knap-primaer" },
];

export default function SystemEditor({ systemId, nytSystem, onLuk }) {
  const { data, opdater } = useData();
  const { spoerg, bekraeftSlet } = useDialog();
  const { saetForladVagt } = useNavigation();

  // Den lokale arbejdskopi (null = seer-tilstand). Et nyt system åbner direkte i redigering.
  const [kladde, setKladde] = useState(nytSystem);
  const [erNy, setErNy] = useState(Boolean(nytSystem));    // findes ikke i data.systemer endnu
  const [aendret, setAendret] = useState(Boolean(nytSystem)); // "● Ikke gemt"
  const [sidstGemt, setSidstGemt] = useState(null);         // klokkeslæt, fx "14:32"
  const [praesentation, setPraesentation] = useState(false);
  // 🎯 Quiz (kun i seer-tilstand): når den er slået til, vises Quiz.jsx i stedet for banen og afspilleren
  const [quiz, setQuiz] = useState(false);
  const navnRef = useRef(null);

  /*
    🎬 Gem som video: optagelse = null (ingen optagelse) eller hvor langt vi er (0-1).
    optagStyring er en AbortController – med den kan vi stoppe optagelsen (Annuller,
    eller hvis man forlader siden midt i en optagelse).
  */
  const [optagelse, setOptagelse] = useState(null);
  const optagStyring = useRef(null);
  const optager = optagelse !== null;
  useEffect(() => () => optagStyring.current?.abort(), []);   // siden lukkes → stop optagelsen

  // Tekst under banen er fjernet (ejerens ønske). Trinenes tekster bruges stadig i quizzens feedback.
  const visTekst = false;

  // Den gemte udgave fra appens data (undefined hvis systemet er nyt eller slettet)
  const gemt = data.systemer.find(s => s.id === systemId);
  const redigerer = kladde !== null;
  // Det system vi viser: arbejdskopien når man redigerer, ellers den gemte udgave
  const system = kladde ?? gemt;

  /*
    Den AKTIVE variant (kun hvis systemet har en forgrening). Det er bare et valg på skærmen
    (useState) – det gemmes ikke i systemet. null = den første variant.
    findVariant() falder også tilbage til den første, hvis id'et ikke findes (længere).
  */
  const [valgtVariantId, setValgtVariantId] = useState(null);
  const forgrenet = system ? harForgrening(system) : false;
  const variantId = forgrenet ? findVariant(system, valgtVariantId).id : null;
  // Den effektive tidslinje: fælles trin + aktiv variant (uden forgrening: systemet selv)
  const effektiv = system ? effektivtSystem(system, variantId) : null;
  const antalTrin = effektiv ? effektiv.trin.length : 1;

  const afspil = useAfspilning(antalTrin);
  const { koerer } = afspil;
  // Sikkerhed: er tidslinjen lige blevet kortere (fx en anden variant), må tiden ikke pege
  // ud over det sidste trin – så bruger vi det sidste trin, indtil tiden er sat på plads.
  const tid = Math.min(afspil.tid, antalTrin - 1);
  const trinIndex = Number.isInteger(tid) ? tid : null;
  const kanRedigere = redigerer && !koerer && trinIndex !== null;
  // Quizzen findes kun i seer-tilstand (sikkerhed, hvis man skulle komme i redigering imens)
  const quizAktiv = quiz && !redigerer;

  // Navnet på trin nr. index, fx "3" eller "4A" (variant-trin får variantens bogstav)
  function navnPaaTrin(index) {
    return system ? trinNavn(system, variantId, index) : String(index + 1);
  }

  // Er systemet forsvundet (fx slettet eller erstattet ved "Hent fil")? → tilbage til oversigten
  useEffect(() => {
    if (!system) onLuk();
  }, [system, onLuk]);

  // Et nyt system: markér navnet, så man bare kan skrive et nyt (kører én gang ved start)
  useEffect(() => {
    if (nytSystem && navnRef.current) navnRef.current.select();
  }, [nytSystem]);

  /* ---------- Gem / kassér ---------- */

  // Skriv arbejdskopien ind i appens data
  function gem() {
    if (!kladde) return;
    const kopi = structuredClone(kladde);
    opdater(d => {
      const i = d.systemer.findIndex(s => s.id === kopi.id);
      if (i >= 0) d.systemer[i] = kopi;
      else d.systemer.push(kopi);          // nyt system: først nu kommer det med i listen
    });
    setErNy(false);
    setAendret(false);
    setSidstGemt(new Date().toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" }));
  }

  /*
    Spørg om ikke-gemte ændringer. Giver "gem", "kasser" eller null ("Bliv her" / Escape).
    Er der ingen ændringer, svarer vi bare "intet" uden at spørge.
  */
  async function spoergOmAendringer() {
    afspil.stop();
    if (!aendret) return "intet";
    const svar = await spoerg("Ikke gemte ændringer",
      `Du har ændringer i "${kladde.navn}", der ikke er gemt. Vil du gemme dem?`, FORLAD_KNAPPER);
    if (svar === "gem") gem();
    return svar;
  }

  // "← Alle systemer"
  async function tilOversigt() {
    const svar = await spoergOmAendringer();
    if (svar === null) return;
    setAendret(false);
    onLuk();
  }

  // "✓ Færdig": tilbage til seer-tilstand
  async function afslutRedigering() {
    const svar = await spoergOmAendringer();
    if (svar === null) return;                       // "Bliv her"
    if (svar === "kasser" && erNy) return onLuk();   // et nyt system blev kasseret → oversigten
    // Gemt eller kasseret: vis den gemte udgave. Gemte vi lige, er det kladden selv.
    const vist = svar === "gem" ? kladde : gemt;
    setKladde(null);
    setAendret(false);
    // Den viste udgave kan have færre trin (fx kasserede trin eller varianter) → hold tiden indenfor
    const vistLaengde = effektivtSystem(vist, valgtVariantId).trin.length;
    afspil.gaaTilTrin(Math.min(Math.round(afspil.tidRef.current), vistLaengde - 1));
  }

  // "✏️ Rediger": lav en arbejdskopi af den gemte udgave
  function startRedigering() {
    afspil.stop();
    skiftPraesentation(false);
    setQuiz(false);
    setKladde(structuredClone(gemt));
    setAendret(false);
    // Står vi midt mellem to trin, hopper vi til nærmeste trin, så man kan redigere med det samme
    if (afspil.trinIndex === null) afspil.gaaTilTrin(Math.round(afspil.tidRef.current));
  }

  // "🗑 Slet system"
  async function sletSystem() {
    afspil.stop();
    if (!(await bekraeftSlet(`Slet "${system.navn}"?`,
        `Systemet og alle dets ${antalTrinIalt(system)} trin bliver slettet. Det kan ikke fortrydes.`))) return;
    if (!erNy) opdater(d => { d.systemer = d.systemer.filter(s => s.id !== systemId); });
    setAendret(false);
    onLuk();
  }

  /* ---------- Ændringer i arbejdskopien ----------
     Vi laver altid NYE objekter i stedet for at rette i de gamle (immutabilitet).
     Så kan React se, at noget er ændret, og tegne forfra. */

  function aendrKladde(fn) {
    setKladde(k => (k ? fn(k) : k));
    setAendret(true);
  }

  /*
    Ændr trinlisten i den DEL, som trin nr. "index" (på den effektive tidslinje) ligger i –
    enten de fælles trin eller den aktive variants trin.
    fn(liste, i) får delens trinliste og trinets plads i den, og giver en ny liste tilbage.
  */
  function aendrDelVedIndex(index, fn) {
    aendrKladde(k => {
      const del = delAfIndex(k, variantId, index);
      if (!del) return k;
      return aendrDel(k, del, liste => fn(liste, del.i));
    });
  }

  // Ændr ét trin: fn får det gamle trin og giver et nyt tilbage
  function aendrTrin(index, fn) {
    aendrDelVedIndex(index, (liste, i) => {
      const gammel = liste[i];
      if (!gammel) return liste;
      const nyt = fn(gammel);
      if (nyt === gammel) return liste;            // intet ændret
      return liste.map((t, j) => (j === i ? nyt : t));
    });
  }

  /*
    "⏺ Optag næste trin": kopiér det aktuelle trin og indsæt kopien lige efter.
    Står man på et fælles trin, bliver det nye trin også fælles. Står man i en variant,
    kommer det nye trin ind i varianten.
  */
  function optagTrin() {
    if (trinIndex === null) return;
    const index = trinIndex;
    aendrDelVedIndex(index, (liste, i) => {
      const trin = [...liste];
      // Det nye trin får positionerne med, men en tom tekst (den skal man selv skrive)
      trin.splice(i + 1, 0, { ...structuredClone(liste[i]), tekst: "" });   // splice indsætter i en liste
      return trin;
    });
    afspil.gaaTilTrin(index + 1);
  }

  // Hvor mange trin er der i den del (fælles eller variant), som trin nr. index ligger i?
  function antalIDel(index) {
    const del = system && index !== null ? delAfIndex(system, variantId, index) : null;
    return del ? trinIDel(system, del).length : antalTrin;
  }

  /*
    Slet trinet med nummer "index" (0 = trin 1). Et system skal have mindst ét trin –
    og med varianter skal både de fælles trin og hver variant have mindst ét trin.
  */
  async function sletTrin(index) {
    if (index === null || antalIDel(index) < 2) return;
    afspil.stop();
    if (!(await bekraeftSlet(`Slet trin ${navnPaaTrin(index)}?`,
        "Trinet bliver fjernet fra animationen. Husk at trykke Gem bagefter."))) return;
    aendrDelVedIndex(index, (liste, i) => liste.filter((_, j) => j !== i));
    afspil.gaaTilTrin(Math.max(0, index - 1));
  }

  // "🥅 Skyd på mål": bolden skydes midt i målet
  function skydPaaMaal() {
    if (trinIndex === null) return;
    aendrTrin(trinIndex, t => ({ ...t, bold: { x: 100, y: -5 } }));
  }

  // Skift modstanderens forsvar: modstanderne sættes på den nye formation i ALLE trin
  // (også alle trin i alle varianter)
  async function skiftForsvar(nytForsvar) {
    if (antalTrinIalt(system) > 1) {
      const svar = await spoerg("Skift forsvar?",
        (erForsvarssystem(system) ? "Vores forsvarsspilleres" : "Modstandernes") +
        " bevægelser i alle trin bliver nulstillet til den nye formation.", [
          { tekst: "Annuller", svar: false },
          { tekst: "Skift forsvar", svar: true, stil: "knap-primaer" },
        ]);
      // Menuen er "controlled" (value={system.forsvar}), så den hopper selv tilbage ved Annuller
      if (svar !== true) return;
    }
    const nyeModstandere = startPositioner(nytForsvar);
    // Ét trin med de nye modstandere
    function nulstilModstandere(t) {
      const pos = {};
      // Behold vores spillere, fjern de gamle modstandere og sæt de nye ind
      for (const noegle in t.pos) if (!noegle.startsWith("M")) pos[noegle] = t.pos[noegle];
      nyeModstandere.forEach((p, i) => { pos["M" + i] = { ...p }; });
      return { ...t, pos };
    }
    aendrKladde(k => {
      const nyt = { ...k, forsvar: nytForsvar, trin: k.trin.map(nulstilModstandere) };
      if (harForgrening(k)) {
        nyt.forgrening = {
          ...k.forgrening,
          varianter: k.forgrening.varianter.map(v => ({ ...v, trin: v.trin.map(nulstilModstandere) })),
        };
      }
      return nyt;
    });
  }

  /*
    Skift systemets type (angreb ↔ forsvar). Positionerne bliver, hvor de er –
    det er kun trøjerne og pilene, der bytter rolle (se systemRoller.js).
  */
  function skiftType(nyType) {
    aendrKladde(k => ({ ...k, type: nyType === "forsvar" ? "forsvar" : "angreb" }));
  }

  /*
    🔄 Skift bane (halv ↔ hel). Se skiftBane() i helBane.js:
      halv → hel: positionerne bliver, hvor de er (de står bare i den øverste halvdel).
      hel → halv: alt på den anden side af midterlinjen flyttes op til midterlinjen, og vores
                  målmand (VM) fjernes. Det spørger vi om først, hvis det rammer nogen.
  */
  async function skiftBaneKlik(vaerdi) {
    const helBane = vaerdi === "hel";
    if (!helBane && brugerNederstePart(system)) {
      const svar = await spoerg("Skift til halv bane?",
        "Spillere og bold på den anden side af midterlinjen bliver flyttet op til midterlinjen " +
        "i alle trin, og målmanden med bolden fjernes. Husk at trykke Gem bagefter.", [
          { tekst: "Annuller", svar: false },
          { tekst: "Skift til halv bane", svar: true, stil: "knap-primaer" },
        ]);
      // Menuen er "controlled" (value fra kladden), så den hopper selv tilbage ved Annuller
      if (svar !== true) return;
    }
    aendrKladde(k => skiftBane(k, helBane));
  }

  /* ---------- 🎬 Gem som video (se videoEksport.js) ----------
     Vi optager den EFFEKTIVE tidslinje (fælles trin + den valgte variant) med den valgte
     hastighed. 💬-teksten kommer med, hvis den er slået til. Imens er knapperne slået fra. */
  async function gemSomVideo() {
    if (optager) return;
    afspil.stop();
    if (!videoFormat()) {
      await spoerg("Video virker ikke her",
        "Din browser kan desværre ikke optage video. Prøv i Chrome, Edge eller Firefox på en computer.", [
          { tekst: "OK", svar: true, stil: "knap-primaer" },
        ]);
      return;
    }
    // Husk systemet og variantens navne, som de er NU (de kan ikke ændres under optagelsen)
    const optagSystem = effektiv;
    const helt = system;
    const vid = variantId;
    const styring = new AbortController();
    optagStyring.current = styring;
    setOptagelse(0);
    try {
      const resultat = await optagVideo({
        system: optagSystem,
        sekPrTrin: afspil.sekPrTrin,
        visTekst,
        trinNavn: (i) => trinNavn(helt, vid, i),
        spillerNavn,
        signal: styring.signal,
        onFremskridt: (andel) => setOptagelse(andel),
      });
      if (resultat) hentFil(resultat.blob, videoFilnavn(helt.navn, resultat.endelse));
    } catch (fejl) {
      console.warn("Videoen kunne ikke laves:", fejl);
      if (!styring.signal.aborted) {
        await spoerg("Videoen kunne ikke laves", "Noget gik galt under optagelsen. Prøv igen – eller i en anden browser.", [
          { tekst: "OK", svar: true, stil: "knap-primaer" },
        ]);
      }
    } finally {
      optagStyring.current = null;
      setOptagelse(null);
    }
  }

  // "Annuller" under optagelsen
  function annullerVideo() {
    optagStyring.current?.abort();
  }

  /* ---------- Varianter (forgrening) ---------- */

  // Hop til en anden variant. Tiden holdes inden for den nye (måske kortere) tidslinje.
  function vaelgVariant(id) {
    const nyLaengde = effektivtSystem(system, id).trin.length;
    setValgtVariantId(id);
    afspil.gaaTilTrin(Math.min(Math.round(afspil.tidRef.current), nyLaengde - 1));
  }

  // "🔀 Del systemet efter trin N"
  function delSystemet() {
    if (trinIndex === null || forgrenet) return;
    const efter = trinIndex;
    aendrKladde(k => opretForgrening(k, efter));
    setValgtVariantId(null);         // null = den første variant (A)
  }

  // Ændr forgreningen (spørgsmål eller variantnavne) – kun hvis der er en
  function aendrForgrening(fn) {
    aendrKladde(k => (harForgrening(k) ? { ...k, forgrening: fn(k.forgrening) } : k));
  }

  // "+ Tilføj variant": den nye variant vises med det samme (på dens første trin)
  function tilfoejVariantKlik() {
    if (!forgrenet || system.forgrening.varianter.length >= MAX_VARIANTER) return;
    const id = nytVariantId();
    aendrKladde(k => tilfoejVariant(k, id));
    setValgtVariantId(id);
    afspil.gaaTilTrin(system.trin.length);   // første trin efter de fælles trin
  }

  // × ved en variant. Er der kun 2 varianter, tilbyder vi i stedet at fjerne forgreningen.
  async function sletVariantKlik(variant, nr) {
    afspil.stop();
    if (system.forgrening.varianter.length <= MIN_VARIANTER) {
      fjernForgreningKlik();
      return;
    }
    if (!(await bekraeftSlet(`Slet variant ${VARIANT_BOGSTAVER[nr]}?`,
        `"${variant.navn || "Uden navn"}" og dens ${variant.trin.length} trin bliver fjernet. Husk at trykke Gem bagefter.`))) return;
    aendrKladde(k => sletVariant(k, variant.id));
    if (variant.id === variantId) {
      // Den viste variant forsvandt → vis den første, og stil os på det sidste fælles trin
      setValgtVariantId(null);
      afspil.gaaTilTrin(Math.min(Math.round(afspil.tidRef.current), system.trin.length - 1));
    }
  }

  // "Fjern forgrening": spørg hvilken variant der skal blive en del af systemet
  async function fjernForgreningKlik() {
    afspil.stop();
    const varianter = system.forgrening.varianter;
    const svar = await spoerg("Fjern forgrening?",
      "Vælg den variant, der skal blive en almindelig del af systemet. De andre varianter bliver slettet. " +
      "Husk at trykke Gem bagefter.", [
        { tekst: "Annuller", svar: null },
        ...varianter.map((v, i) => ({ tekst: `Behold ${VARIANT_BOGSTAVER[i]}: ${v.navn || "Uden navn"}`, svar: v.id })),
      ]);
    if (svar === null || svar === undefined) return;
    const nyLaengde = system.trin.length + findVariant(system, svar).trin.length;
    aendrKladde(k => fjernForgrening(k, svar));
    setValgtVariantId(null);
    afspil.gaaTilTrin(Math.min(Math.round(afspil.tidRef.current), nyLaengde - 1));
  }

  /* ---------- 🎯 Quiz ----------
     Quizzen bruger det EFFEKTIVE system (fælles trin + den valgte variant).
     Den læser kun systemet – den ændrer intet i data.systemer. */

  function startQuiz() {
    if (redigerer) return;           // kun i seer-tilstand
    afspil.stop();
    setQuiz(true);
  }

  // "Afslut quiz" / Esc: tilbage til almindelig visning på trin 1
  function afslutQuiz() {
    setQuiz(false);
    afspil.gaaTilTrin(0);
  }

  /* ---------- Præsentation (fuld skærm) ----------
     Vi lægger klassen "praesentation" på venstre del, så den dækker hele vinduet.
     Derudover beder vi browseren om rigtig fuld skærm. Siger den nej, virker det stadig. */

  function skiftPraesentation(slaaTil) {
    setPraesentation(slaaTil);
    try {
      if (slaaTil && !document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});   // nej tak = ok
      } else if (!slaaTil && document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    } catch {
      // Nogle browsere har slet ikke fuld skærm – så bruger vi bare klassen
    }
  }

  // Lukker man fuld skærm med browserens egen Esc, lukker vi også præsentationen
  useEffect(() => {
    if (!praesentation) return;
    function vedSkift() {
      if (!document.fullscreenElement) setPraesentation(false);
    }
    document.addEventListener("fullscreenchange", vedSkift);
    return () => document.removeEventListener("fullscreenchange", vedSkift);
  }, [praesentation]);

  // Forlader man systemet (komponenten fjernes), lukkes fuld skærm også
  const praesentationRef = useRef(false);
  useEffect(() => { praesentationRef.current = praesentation; }, [praesentation]);
  useEffect(() => () => {
    if (praesentationRef.current && document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  /* ---------- Vagt: ikke-gemte ændringer ---------- */

  // Skifter man fane, spørger App.jsx vores vagt først (se Navigation.jsx)
  useEffect(() => {
    if (!aendret) return;
    saetForladVagt(async () => {
      const svar = await spoergOmAendringer();
      return svar !== null;            // "Bliv her" → bliv
    });
    return () => saetForladVagt(null);  // fjern vagten igen (ved ændring eller når siden lukkes)
  });   // ingen afhængigheder: vagten skal altid kende den nyeste kladde

  // Advar hvis man lukker fanen/browseren med ikke-gemte ændringer
  useEffect(() => {
    if (!aendret) return;
    function advar(e) {
      e.preventDefault();
      e.returnValue = "";              // ældre browsere kræver denne linje
    }
    window.addEventListener("beforeunload", advar);
    return () => window.removeEventListener("beforeunload", advar);
  }, [aendret]);

  /* ---------- Tastatur ----------
     Mellemrum = start/pause, ← → = forrige/næste trin, Esc = luk præsentation, Ctrl+S = gem.
     Lytteren sættes på document ÉN gang. Den kalder altid den nyeste udgave af
     funktionen via en ref – ellers ville den "huske" gamle værdier fra første tegning. */
  const tastRef = useRef(null);
  useEffect(() => {
    tastRef.current = (e) => {
      if (document.querySelector("dialog[open]")) return;    // en "er du sikker?"-boks er åben
      if (optager) return;                                    // 🎬 der optages video – tasterne er slået fra

      // Ctrl+S (Cmd+S på Mac) virker også mens man skriver i navnefeltet
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        if (redigerer) {
          e.preventDefault();          // stop browserens egen "Gem side som..."
          gem();
        }
        return;
      }
      const felt = document.activeElement;
      if (felt && ["INPUT", "TEXTAREA", "SELECT"].includes(felt.tagName)) return;

      // Under quizzen må mellemrum og pilene IKKE starte afspilningen.
      // Esc lukker først præsentationen (hvis den er åben) og ellers quizzen.
      if (quizAktiv) {
        if (e.key === "Escape") {
          if (praesentation) skiftPraesentation(false);
          else afslutQuiz();
        }
        return;
      }

      if (e.key === " ") {
        e.preventDefault();            // mellemrum må ikke scrolle siden
        afspil.startEllerPause();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        afspil.naesteTrin();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        afspil.forrigeTrin();
      } else if (e.key === "Escape" && praesentation) {
        skiftPraesentation(false);
      }
    };
  });
  useEffect(() => {
    const lyt = (e) => tastRef.current?.(e);
    document.addEventListener("keydown", lyt);
    return () => document.removeEventListener("keydown", lyt);
  }, []);

  if (!system) return null;

  // Spillerens navn under figuren (fra opstillingen på taktiktavlen)
  // "VM" (målmanden på hel bane) er målmanden fra tavlens MV-plads
  function spillerNavn(noegle) {
    const id = data.opstilling[noegle === "VM" ? "MV" : noegle];
    const spiller = data.spillere.find(s => s.id === id);
    return spiller ? spiller.navn : "";
  }

  // Tidslinjen: piletasterne springer et helt trin ad gangen
  function tidslinjeTast(e) {
    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      afspil.naesteTrin();
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      afspil.forrigeTrin();
    }
  }

  const gemStatus = aendret
    ? { tekst: "● Ikke gemt", klasse: "gem-status aendret" }
    : sidstGemt
      ? { tekst: `Gemt ✓ kl. ${sidstGemt}`, klasse: "gem-status gemt" }
      : { tekst: "Alt er gemt", klasse: "gem-status" };

  const trinHjaelp = koerer
    ? "Afspiller… tryk Pause for at stoppe."
    : trinIndex === null
      ? "Du står mellem to trin. Klik på et trin-nummer for at redigere."
      : trinIndex === 0
        ? "Trin 1 er startopstillingen. Træk spillerne på plads og klik på den der skal have bolden."
        : `Trin ${navnPaaTrin(trinIndex)}: træk spillerne derhen hvor de løber. Klik på en spiller for at aflevere til ham, ` +
          "eller træk bolden for at kaste den – slip den i målet for at skyde.";

  /*
    Hvilken tekst skal vises lige nu?
    - Står vi PÅ et trin: det trins tekst.
    - Er vi MELLEM to trin: teksten for det trin, spillerne er på vej hen til
      (den beskriver jo det, der sker lige nu).
    Vi kigger i den effektive tidslinje, så variant-trinenes tekst også kommer med.
  */
  const tekstTrinIndex = trinIndex !== null ? trinIndex : Math.min(Math.floor(tid) + 1, antalTrin - 1);
  const aktuelTekst = effektiv?.trin[tekstTrinIndex]?.tekst || "";

  // Hvor mange trin er der i den del, man står i? (Under 2 → man må ikke slette trinet)
  const antalIAktuelDel = antalIDel(trinIndex);
  // Forsvarssystem? (vi er forsvaret – se systemRoller.js)
  const forsvarssystem = erForsvarssystem(system);
  // Er systemet på hel bane (kontra/omstilling – se helBane.js)?
  const helBane = system.helBane === true;
  const varianter = forgrenet ? system.forgrening.varianter : [];

  return (
    // "optager" = der optages video lige nu (knapperne er slået fra – se Systemer.css)
    <div className={"system-editor" + (redigerer ? "" : " seer") + (optager ? " optager" : "")}>

      {/* VENSTRE: banen + afspilleren */}
      {/* Under quizzen er der altid en bjælke under banen (som 💬-tekstbjælken) og ingen
          variant-menu – derfor "med-tekst" og ikke "med-varianter", så banen får den rigtige størrelse.
          "hel-bane" = systemet er på hel bane (banen er højere – se Systemer.css) */}
      <section className={"system-venstre" + (praesentation ? " praesentation" : "") +
                          (helBane ? " hel-bane" : "") +
                          (quizAktiv || visTekst ? " med-tekst" : "") +
                          (forgrenet && !quizAktiv ? " med-varianter" : "") + (quizAktiv ? " quiz-aktiv" : "")}>
        {/* Topbjælke der KUN vises i seer-tilstand (styres af CSS) */}
        <div className="seer-top">
          <div>
            <h2>
              {system.navn}
              {forsvarssystem && <span className="system-maerke forsvar">🛡️ Forsvar</span>}
              {helBane && <span className="system-maerke hel-bane">🔄 Hel bane</span>}
            </h2>
            <p className="opsummering">{system.beskrivelse}</p>
          </div>
          <div className="seer-knapper">
            {/* id'erne bruges af den gamle CSS til at skjule knapperne i præsentation */}
            <button className="knap" id="seer-tilbage-knap" onClick={tilOversigt}>← Alle systemer</button>
            <button className="knap" title="Vis i fuld skærm" onClick={() => skiftPraesentation(!praesentation)}>
              {praesentation ? "✕ Luk præsentation" : "⛶ Præsentation"}
            </button>
            <button
              className={"knap" + (quizAktiv ? " aktiv-knap" : "")}
              title={quizAktiv ? "Afslut quizzen (Esc)" : "Gæt hvor spillerne løber"}
              onClick={quizAktiv ? afslutQuiz : startQuiz}
            >
              {quizAktiv ? "✕ Afslut quiz" : "🎯 Quiz"}
            </button>
            {/* 🎬 Optag systemet som en video (ikke under quizzen) */}
            {!quizAktiv && (
              <button className="knap" title="Gem systemet som en video (.webm) – fx til holdets chat"
                      disabled={optager} onClick={gemSomVideo}>
                🎬 Gem som video
              </button>
            )}
            {/* Under quizzen skjuler vi Rediger – man afslutter quizzen først */}
            {!quizAktiv && (
              <button className="knap knap-primaer" id="rediger-knap" onClick={startRedigering}>✏️ Rediger</button>
            )}
          </div>
          <p className="tast-hjaelp">
            {quizAktiv
              ? "Træk den gule spiller · Esc = luk præsentation / afslut quiz"
              : "Mellemrum = start/pause · ← → = forrige/næste trin · Esc = luk"}
          </p>
        </div>

        {/* 🎬 Mens videoen optages: hvor langt vi er + Annuller */}
        {optager && (
          <div className="video-status" role="status">
            <span>🎬 Optager… {Math.round(optagelse * 100)} %</span>
            <div className="video-linje"><div style={{ width: `${Math.round(optagelse * 100)}%` }} /></div>
            <button className="knap" onClick={annullerVideo}>Annuller</button>
          </div>
        )}

        {/* 🎯 Quizzen tager banens og afspillerens plads. "key" gør, at quizzen starter forfra
            (en helt ny komponent), hvis man skulle skifte variant. */}
        {quizAktiv ? (
          <Quiz
            key={variantId ?? "ingen"}
            system={effektiv}
            spillerNavn={spillerNavn}
            trinNavn={navnPaaTrin}
            onAfslut={afslutQuiz}
          />
        ) : (
        <>
        {/* Banen får den effektive tidslinje (fælles trin + aktiv variant) */}
        <SystemBane
          system={effektiv}
          tid={tid}
          trinIndex={trinIndex}
          kanRedigere={kanRedigere}
          aendrTrin={aendrTrin}
          spillerNavn={spillerNavn}
          trinNavn={navnPaaTrin}
        />

        {/* 🔀 Har systemet varianter, vælger man her, hvilken der skal afspilles (før man trykker Start) */}
        {forgrenet && (
          <div className="variant-vaelger">
            <span className="variant-spoergsmaal">🔀 {system.forgrening.spoergsmaal || "Vælg variant"}</span>
            <select
              className="lille-valg"
              title="Hvilken variant skal afspilles?"
              value={variantId}
              onChange={(e) => vaelgVariant(e.target.value)}
            >
              {varianter.map((v, i) => (
                <option key={v.id} value={v.id}>{VARIANT_BOGSTAVER[i]}: {v.navn || "Uden navn"}</option>
              ))}
            </select>
          </div>
        )}

        <div className="afspiller">
          <button className="knap" title="Tilbage til start" onClick={() => afspil.gaaTilTrin(0)}>⏮</button>
          <button className="knap knap-primaer afspil-knap" disabled={antalTrin < 2} onClick={afspil.startEllerPause}>
            {koerer ? "⏸ Pause" : "▶ Start"}
          </button>
          {/* Tidslinjen: træk for at spole. Når man slipper, hopper vi til nærmeste trin. */}
          <input
            type="range"
            min="0"
            max={antalTrin - 1}
            step="0.01"
            value={tid}
            onChange={(e) => afspil.spol(Number(e.target.value))}
            onPointerUp={() => afspil.gaaTilTrin(Math.round(afspil.tidRef.current))}
            onKeyDown={tidslinjeTast}
          />
          <select
            className="lille-valg"
            title="Hastighed"
            value={afspil.sekPrTrin}
            onChange={(e) => afspil.saetHastighed(Number(e.target.value))}
          >
            <option value={2.5}>Langsom</option>
            <option value={1.5}>Normal</option>
            <option value={0.8}>Hurtig</option>
          </select>
        </div>
        </>
        )}
      </section>

      {/* HØJRE: panelet til redigering (skjules af CSS i seer-tilstand) */}
      {redigerer && (
        <section className="kort system-panel">
          <div className="knap-raekke">
            <button className="knap" onClick={tilOversigt}>← Alle systemer</button>
            <button className="knap knap-fare" onClick={sletSystem}>🗑 Slet system</button>
          </div>
          <div className="gem-raekke">
            <button className="knap knap-primaer" title="Gem (Ctrl+S)" onClick={gem}>💾 Gem system</button>
            <span className={gemStatus.klasse}>{gemStatus.tekst}</span>
            <button className="knap" style={{ marginLeft: "auto" }} title="Afslut redigering" onClick={afslutRedigering}>
              ✓ Færdig
            </button>
          </div>

          {/* "Controlled" felter: value kommer fra kladden, og onChange retter i kladden */}
          <label className="felt">Navn
            <input
              ref={navnRef}
              type="text"
              maxLength={40}
              value={system.navn}
              onChange={(e) => { const navn = e.target.value; aendrKladde(k => ({ ...k, navn })); }}
            />
          </label>
          <label className="felt">Beskrivelse
            <textarea
              rows={3}
              maxLength={400}
              placeholder="Hvad går systemet ud på? Hvad skal center kigge efter?"
              value={system.beskrivelse}
              onChange={(e) => { const beskrivelse = e.target.value; aendrKladde(k => ({ ...k, beskrivelse })); }}
            />
          </label>
          <label className="felt">Type
            <select value={forsvarssystem ? "forsvar" : "angreb"} onChange={(e) => skiftType(e.target.value)}>
              <option value="angreb">⚔️ Angreb – vi har bolden</option>
              <option value="forsvar">🛡️ Forsvar – modstanderen har bolden</option>
            </select>
          </label>
          {/* Halv bane (almindelige systemer) eller hel bane (kontra/omstilling) */}
          <label className="felt">Bane
            <select value={helBane ? "hel" : "halv"} onChange={(e) => skiftBaneKlik(e.target.value)}>
              <option value="halv">Halv bane</option>
              <option value="hel">🔄 Hel bane (kontra/omstilling)</option>
            </select>
          </label>
          {/* I et forsvarssystem er formationen VORES forsvar (de gule trøjer) */}
          <label className="felt">{forsvarssystem ? "Vores forsvar" : "Modstanderens forsvar"}
            <select value={system.forsvar} onChange={(e) => skiftForsvar(e.target.value)}>
              <option value="">Intet</option>
              <option value="6-0">6-0</option>
              <option value="5-1">5-1</option>
              <option value="3-2-1">3-2-1</option>
            </select>
          </label>

          <h3>Trin</h3>
          {/* Trin-knapperne: de fælles trin, så ◆ (hvor systemet deler sig) og den aktive variants trin */}
          <div className="trin-knapper">
            {effektiv.trin.map((_, index) => {
              const erVariantTrin = forgrenet && index >= system.trin.length;
              return (
                // Fragment = en "usynlig" indpakning, så vi kan returnere ◆ og knappen sammen
                <Fragment key={index}>
                  {forgrenet && index === system.trin.length && (
                    <span className="forgrening-maerke" title={`Her deler systemet sig: ${system.forgrening.spoergsmaal}`}>◆</span>
                  )}
                  <button
                    className={"trin-knap" + (erVariantTrin ? " variant-trin" : "") + (index === trinIndex ? " aktiv" : "")}
                    title={`Gå til trin ${navnPaaTrin(index)}`}
                    onClick={() => afspil.gaaTilTrin(index)}
                  >
                    {navnPaaTrin(index)}
                    {/* Et lille × til at slette trinet (kun hvis der er mere end ét trin i delen) */}
                    {antalIDel(index) > 1 && (
                      <span
                        className="trin-slet"
                        title={`Slet trin ${navnPaaTrin(index)}`}
                        onClick={(e) => { e.stopPropagation(); sletTrin(index); }}
                      >×</span>
                    )}
                  </button>
                </Fragment>
              );
            })}
          </div>
          <p className="hjaelp">{trinHjaelp}</p>


          <div className="knap-raekke">
            <button className="knap knap-primaer" disabled={!kanRedigere} onClick={optagTrin}>⏺ Optag næste trin</button>
            <button
              className="knap knap-fare"
              disabled={!kanRedigere || antalIAktuelDel < 2}
              title={antalIAktuelDel < 2
                ? (forgrenet ? "De fælles trin og hver variant skal have mindst ét trin" : "Et system skal have mindst ét trin")
                : ""}
              onClick={() => sletTrin(trinIndex)}
            >
              {trinIndex !== null ? `🗑 Slet trin ${navnPaaTrin(trinIndex)}` : "🗑 Slet trin"}
            </button>
          </div>
          <button className="knap" disabled={!kanRedigere} onClick={skydPaaMaal}>🥅 Skyd på mål</button>

          {/* ---------- 🔀 Varianter ---------- */}
          <h3>🔀 Varianter</h3>
          {!forgrenet ? (
            <>
              <p className="hjaelp">
                Gør forsvaret forskellige ting? Del systemet efter et trin, så det kan fortsætte på
                2-4 forskellige måder (varianter). Trinene før delingen er fælles for alle varianter.
              </p>
              <button className="knap" disabled={!kanRedigere} onClick={delSystemet}>
                {trinIndex !== null ? `🔀 Del systemet efter trin ${trinIndex + 1}` : "🔀 Del systemet efter et trin"}
              </button>
            </>
          ) : (
            <div className="varianter">
              <label className="felt">Spørgsmål efter trin {system.trin.length}
                <input
                  type="text"
                  maxLength={80}
                  placeholder="Fx: Træder 2'eren ud?"
                  value={system.forgrening.spoergsmaal}
                  onChange={(e) => { const spoergsmaal = e.target.value; aendrForgrening(f => ({ ...f, spoergsmaal })); }}
                />
              </label>

              {/* Én række pr. variant: bogstav, navn, "Vis" og × */}
              {varianter.map((v, i) => {
                const aktiv = v.id === variantId;
                return (
                  <div key={v.id} className={"variant-raekke" + (aktiv ? " aktiv" : "")}>
                    <span className="variant-bogstav">{VARIANT_BOGSTAVER[i]}</span>
                    <input
                      type="text"
                      maxLength={40}
                      aria-label={`Navn på variant ${VARIANT_BOGSTAVER[i]}`}
                      placeholder="Fx: Ja – aflever til fløjen"
                      value={v.navn}
                      onChange={(e) => {
                        const navn = e.target.value;
                        aendrForgrening(f => ({ ...f, varianter: f.varianter.map(x => (x.id === v.id ? { ...x, navn } : x)) }));
                      }}
                    />
                    <button
                      className={"knap variant-vis" + (aktiv ? " aktiv-knap" : "")}
                      title="Vis og rediger denne variant"
                      onClick={() => vaelgVariant(v.id)}
                    >
                      {aktiv ? "👁 Vises" : "Vis"}
                    </button>
                    <button
                      className="slet-x"
                      title={varianter.length <= MIN_VARIANTER ? "Fjern forgrening" : `Slet variant ${VARIANT_BOGSTAVER[i]}`}
                      onClick={() => sletVariantKlik(v, i)}
                    >×</button>
                  </div>
                );
              })}

              <div className="knap-raekke">
                <button
                  className="knap"
                  disabled={varianter.length >= MAX_VARIANTER}
                  title={varianter.length >= MAX_VARIANTER ? `Højst ${MAX_VARIANTER} varianter` : ""}
                  onClick={tilfoejVariantKlik}
                >
                  + Tilføj variant
                </button>
                <button className="knap knap-fare" onClick={fjernForgreningKlik}>Fjern forgrening</button>
              </div>
              <p className="hjaelp">
                Trinene efter ◆ hører til den variant, der vises. Vælg en anden variant med <b>Vis</b> for at
                redigere den. Ved afspilning vælger man varianten i menuen over afspilleren.
              </p>
            </div>
          )}

          {/* ---------- 🎬 Video ---------- */}
          <h3>🎬 Video</h3>
          <p className="hjaelp">
            Gem systemet som en video, du kan sende til holdet. Videoen viser {forgrenet ? "den variant, der vises nu, " : ""}
            fra trin 1 til sidste trin med den valgte hastighed{visTekst ? " – med 💬-teksten" : ""}.
            Det, du ikke har gemt, kommer også med.
          </p>
          <button className="knap" disabled={optager} onClick={gemSomVideo}>🎬 Gem som video</button>

          <h3>Sådan optager du</h3>
          <ol className="hjaelp">
            <li>Stil spillerne op i trin 1. <b>Klik</b> på en spiller for at give ham bolden.</li>
            <li>Tryk <b>⏺ Optag næste trin</b> – der laves en kopi af trinet.</li>
            <li><b>Træk</b> spillerne derhen hvor de skal løbe, og giv bolden videre.</li>
            <li><b>Træk bolden</b> for at kaste den: slip den ved en spiller (han griber den),
                ude i rummet, eller <b>i målet</b> for at skyde.</li>
            <li>Gentag – og tryk <b>▶ Start</b> for at se animationen.</li>
          </ol>

          <h3>Pile</h3>
          <div className="hjaelp">
            <div>{forsvarssystem ? "━━➤ Løb for vores forsvarsspillere (gul)" : "━━➤ Løb (i spillerens farve)"}</div>
            <div>╌╌➤ Aflevering / kast</div>
            <div><span style={{ color: "#fde047" }}>╌╌➤</span> Skud på mål</div>
          </div>
        </section>
      )}
    </div>
  );
}
