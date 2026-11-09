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
*/
import { useEffect, useRef, useState } from "react";
import { useData } from "../../DataKontekst.jsx";
import { useDialog } from "../../komponenter/Dialog.jsx";
import { useNavigation } from "../../Navigation.jsx";
import { startPositioner } from "../../data/standardData.js";
import useAfspilning from "./useAfspilning.js";
import SystemBane from "./SystemBane.jsx";

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
  const navnRef = useRef(null);

  // Den gemte udgave fra appens data (undefined hvis systemet er nyt eller slettet)
  const gemt = data.systemer.find(s => s.id === systemId);
  const redigerer = kladde !== null;
  // Det system vi viser: arbejdskopien når man redigerer, ellers den gemte udgave
  const system = kladde ?? gemt;
  const antalTrin = system ? system.trin.length : 1;

  const afspil = useAfspilning(antalTrin);
  const { tid, trinIndex, koerer } = afspil;
  const kanRedigere = redigerer && !koerer && trinIndex !== null;

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
    afspil.gaaTilTrin(Math.min(Math.round(afspil.tidRef.current), vist.trin.length - 1));
  }

  // "✏️ Rediger": lav en arbejdskopi af den gemte udgave
  function startRedigering() {
    afspil.stop();
    skiftPraesentation(false);
    setKladde(structuredClone(gemt));
    setAendret(false);
    // Står vi midt mellem to trin, hopper vi til nærmeste trin, så man kan redigere med det samme
    if (afspil.trinIndex === null) afspil.gaaTilTrin(Math.round(afspil.tidRef.current));
  }

  // "🗑 Slet system"
  async function sletSystem() {
    afspil.stop();
    if (!(await bekraeftSlet(`Slet "${system.navn}"?`,
        `Systemet og alle dets ${system.trin.length} trin bliver slettet. Det kan ikke fortrydes.`))) return;
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

  // Ændr ét trin: fn får det gamle trin og giver et nyt tilbage
  function aendrTrin(index, fn) {
    aendrKladde(k => {
      const gammel = k.trin[index];
      if (!gammel) return k;
      const nyt = fn(gammel);
      if (nyt === gammel) return k;                // intet ændret
      return { ...k, trin: k.trin.map((t, i) => (i === index ? nyt : t)) };
    });
  }

  // "⏺ Optag næste trin": kopiér det aktuelle trin og indsæt kopien lige efter
  function optagTrin() {
    if (trinIndex === null) return;
    const index = trinIndex;
    aendrKladde(k => {
      const trin = [...k.trin];
      trin.splice(index + 1, 0, structuredClone(k.trin[index]));   // splice indsætter i en liste
      return { ...k, trin };
    });
    afspil.gaaTilTrin(index + 1);
  }

  // Slet trinet med nummer "index" (0 = trin 1). Et system skal have mindst ét trin.
  async function sletTrin(index) {
    if (index === null || system.trin.length < 2) return;
    afspil.stop();
    if (!(await bekraeftSlet(`Slet trin ${index + 1}?`,
        "Trinet bliver fjernet fra animationen. Husk at trykke Gem bagefter."))) return;
    aendrKladde(k => ({ ...k, trin: k.trin.filter((_, i) => i !== index) }));
    afspil.gaaTilTrin(Math.max(0, index - 1));
  }

  // "🥅 Skyd på mål": bolden skydes midt i målet
  function skydPaaMaal() {
    if (trinIndex === null) return;
    aendrTrin(trinIndex, t => ({ ...t, bold: { x: 100, y: -5 } }));
  }

  // Skift modstanderens forsvar: modstanderne sættes på den nye formation i ALLE trin
  async function skiftForsvar(nytForsvar) {
    if (system.trin.length > 1) {
      const svar = await spoerg("Skift forsvar?",
        "Modstandernes bevægelser i alle trin bliver nulstillet til den nye formation.", [
          { tekst: "Annuller", svar: false },
          { tekst: "Skift forsvar", svar: true, stil: "knap-primaer" },
        ]);
      // Menuen er "controlled" (value={system.forsvar}), så den hopper selv tilbage ved Annuller
      if (svar !== true) return;
    }
    const nyeModstandere = startPositioner(nytForsvar);
    aendrKladde(k => ({
      ...k,
      forsvar: nytForsvar,
      trin: k.trin.map(t => {
        const pos = {};
        // Behold vores spillere, fjern de gamle modstandere og sæt de nye ind
        for (const noegle in t.pos) if (!noegle.startsWith("M")) pos[noegle] = t.pos[noegle];
        nyeModstandere.forEach((p, i) => { pos["M" + i] = { ...p }; });
        return { ...t, pos };
      }),
    }));
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
  function spillerNavn(noegle) {
    const id = data.opstilling[noegle];
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
        : `Trin ${trinIndex + 1}: træk spillerne derhen hvor de løber. Klik på en spiller for at aflevere til ham, ` +
          "eller træk bolden for at kaste den – slip den i målet for at skyde.";

  return (
    <div className={"system-editor" + (redigerer ? "" : " seer")}>

      {/* VENSTRE: banen + afspilleren */}
      <section className={"system-venstre" + (praesentation ? " praesentation" : "")}>
        {/* Topbjælke der KUN vises i seer-tilstand (styres af CSS) */}
        <div className="seer-top">
          <div>
            <h2>{system.navn}</h2>
            <p className="opsummering">{system.beskrivelse}</p>
          </div>
          <div className="seer-knapper">
            {/* id'erne bruges af den gamle CSS til at skjule knapperne i præsentation */}
            <button className="knap" id="seer-tilbage-knap" onClick={tilOversigt}>← Alle systemer</button>
            <button className="knap" title="Vis i fuld skærm" onClick={() => skiftPraesentation(!praesentation)}>
              {praesentation ? "✕ Luk præsentation" : "⛶ Præsentation"}
            </button>
            <button className="knap knap-primaer" id="rediger-knap" onClick={startRedigering}>✏️ Rediger</button>
          </div>
          <p className="tast-hjaelp">Mellemrum = start/pause · ← → = forrige/næste trin · Esc = luk</p>
        </div>

        <SystemBane
          system={system}
          tid={tid}
          trinIndex={trinIndex}
          kanRedigere={kanRedigere}
          aendrTrin={aendrTrin}
          spillerNavn={spillerNavn}
        />

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
          <label className="felt">Modstanderens forsvar
            <select value={system.forsvar} onChange={(e) => skiftForsvar(e.target.value)}>
              <option value="">Intet</option>
              <option value="6-0">6-0</option>
              <option value="5-1">5-1</option>
              <option value="3-2-1">3-2-1</option>
            </select>
          </label>

          <h3>Trin</h3>
          <div className="trin-knapper">
            {system.trin.map((_, index) => (
              <button
                key={index}
                className={"trin-knap" + (index === trinIndex ? " aktiv" : "")}
                title={`Gå til trin ${index + 1}`}
                onClick={() => afspil.gaaTilTrin(index)}
              >
                {index + 1}
                {/* Et lille × til at slette trinet (kun hvis der er mere end ét trin) */}
                {antalTrin > 1 && (
                  <span
                    className="trin-slet"
                    title={`Slet trin ${index + 1}`}
                    onClick={(e) => { e.stopPropagation(); sletTrin(index); }}
                  >×</span>
                )}
              </button>
            ))}
          </div>
          <p className="hjaelp">{trinHjaelp}</p>
          <div className="knap-raekke">
            <button className="knap knap-primaer" disabled={!kanRedigere} onClick={optagTrin}>⏺ Optag næste trin</button>
            <button
              className="knap knap-fare"
              disabled={!kanRedigere || antalTrin < 2}
              title={antalTrin < 2 ? "Et system skal have mindst ét trin" : ""}
              onClick={() => sletTrin(trinIndex)}
            >
              {trinIndex !== null ? `🗑 Slet trin ${trinIndex + 1}` : "🗑 Slet trin"}
            </button>
          </div>
          <button className="knap" disabled={!kanRedigere} onClick={skydPaaMaal}>🥅 Skyd på mål</button>

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
            <div>━━➤ Løb (i spillerens farve)</div>
            <div>╌╌➤ Aflevering / kast</div>
            <div><span style={{ color: "#fde047" }}>╌╌➤</span> Skud på mål</div>
          </div>
        </section>
      )}
    </div>
  );
}
