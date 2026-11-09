/*
  SIDE 5: KAMPDAG – live registrering under en kamp.

  Øverst:   måltavlen (vores score – kampuret – modstanderens score)
  Venstre:  vores spillere med knapper (mål, assist, afbrænder, teknisk fejl, 2 min)
  Højre:    aktive udvisninger, hændelsesloggen og "Afslut kamp og gem"

  Alt om kampen ligger i data.kampdag (se nyKampdag() i standardData.js), så
  kampen overlever, at man skifter fane eller genindlæser siden.

  KAMPURET
  I stedet for at tælle sekunder med en timer (som kan gå skævt), husker vi
  HVORNÅR uret blev startet. Kamptiden = gemte sekunder + tiden siden start.
  En setInterval tegner bare siden forfra 4 gange i sekundet, så uret "går".
*/
import { useEffect, useRef, useState } from "react";
import { useData } from "../DataKontekst.jsx";
import { useDialog } from "../komponenter/Dialog.jsx";
import { HJEMME, KAMP_HANDLINGER } from "../data/konstanter.js";
import { nyKampdag } from "../data/standardData.js";
import { aktivSkade, formatUr, idagISO, nytId, sorteretTrup } from "../hjaelpere.js";

/* =========================================================
   HJÆLPEFUNKTIONER (uden for komponenten – de ændrer ikke noget)
   ========================================================= */

// Kamptiden i sekunder. "nu" er tidspunktet vi regner ud fra (Date.now()).
function kamptid(k, nu) {
  const ekstra = k.koerer ? Math.max(0, (nu - k.startetVed) / 1000) : 0;
  return k.sekunder + ekstra;
}

// Hvornår slutter den halvleg vi er i? (1. halvleg: 30:00, 2. halvleg: 60:00)
function halvlegSlut(k) {
  return k.halvleg * k.halvlegMin * 60;
}

// En spillers tal i kampen – til VISNING (laver ikke noget nyt i data)
const NUL_STATS = { maal: 0, assists: 0, afbraendere: 0, tekniskeFejl: 0, udvisninger: 0 };
function statsAf(k, spillerId) {
  return k.stats[spillerId] || NUL_STATS;
}

// En spillers tal – til at RETTE i (bruges kun inde i opdater på kopien)
function statsTilRetning(k, spillerId) {
  if (!k.stats[spillerId]) k.stats[spillerId] = { ...NUL_STATS };
  return k.stats[spillerId];
}

// Er spilleren med i kampen? Hvis man ikke har valgt, er alle der ikke er skadet, med.
function erMed(k, spiller) {
  return spiller.id in k.med ? k.med[spiller.id] : !aktivSkade(spiller);
}

// Læg en hændelse i loggen (bruges kun inde i opdater på kopien)
function tilfoejHaendelse(k, nu, h) {
  k.haendelser.push({ id: nu + Math.random(), sek: Math.floor(kamptid(k, nu)), ...h });
}

/* =========================================================
   KOMPONENTEN
   ========================================================= */
export default function Kampdag() {
  const { data, opdater } = useData();
  const { spoerg, bekraeftSlet } = useDialog();
  const kampdag = data.kampdag;
  const modstanderFelt = useRef(null);

  // "nu" = tidspunktet siden sidst blev tegnet. Intervallet nedenfor sætter det
  // 4 gange i sekundet – og fordi det er state, tegner React siden forfra hver gang.
  const [nu, setNu] = useState(() => Date.now());

  // useEffect med setInterval: start et "ur" når siden vises ...
  useEffect(() => {
    const interval = setInterval(() => setNu(Date.now()), 250);
    // ... og STOP det igen, når siden forsvinder (cleanup). Ellers ville
    // intervallet blive ved med at køre i baggrunden, selvom siden er væk.
    return () => clearInterval(interval);
  }, []);

  /*
    Efter hver tegning: er halvlegen slut, eller er en udvisning udløbet?
    Kun DÅ skriver vi til data (ikke hvert kvarte sekund).
    Inde i opdater tjekker vi igen på den friske kopi, så det aldrig sker to gange.
  */
  useEffect(() => {
    const tid = kamptid(kampdag, Date.now());
    const halvlegErSlut = kampdag.koerer && tid >= halvlegSlut(kampdag);
    const udloebet = kampdag.udvisninger.some(u => u.slutSek <= tid);
    if (!halvlegErSlut && !udloebet) return;

    opdater(d => {
      const k = d.kampdag;
      const tidNu = Date.now();
      // Halvlegen er slut → stop uret ved præcis 30:00 / 60:00
      if (k.koerer && kamptid(k, tidNu) >= halvlegSlut(k)) {
        k.sekunder = halvlegSlut(k);
        k.koerer = false;
        tilfoejHaendelse(k, tidNu, { type: "info", tekst: k.halvleg === 1 ? "🔔 Halvleg" : "🔔 Slutfløjt" });
      }
      // Udvisninger der er udløbet, fjernes (de tæller kun, mens uret går – ligesom i en rigtig kamp)
      const t = kamptid(k, tidNu);
      k.udvisninger = k.udvisninger.filter(u => u.slutSek > t);
    });
  }, [nu, kampdag, opdater]);

  // Kamptiden lige nu (til visning)
  const tid = kamptid(kampdag, nu);

  /* ---------- Uret ---------- */
  function startStopUr() {
    const tidNu = Date.now();
    opdater(d => {
      const k = d.kampdag;
      if (k.koerer) {
        k.sekunder = kamptid(k, tidNu);   // gem tiden der er gået
        k.koerer = false;
      } else {
        // Er halvlegen slut, kan uret ikke startes – man skal trykke "2. halvleg"
        if (k.sekunder >= halvlegSlut(k)) return;
        k.startetVed = tidNu;
        k.koerer = true;
      }
    });
  }

  function startAndenHalvleg() {
    const tidNu = Date.now();
    opdater(d => {
      const k = d.kampdag;
      if (k.halvleg === 2) return;
      const foer = kamptid(k, tidNu);
      k.sekunder = Math.max(foer, k.halvlegMin * 60);   // 2. halvleg starter ved fx 30:00
      // Hopper uret frem, skal aktive udvisninger flyttes lige så meget (resten afsones i 2. halvleg)
      const hop = k.sekunder - foer;
      k.udvisninger.forEach(u => { u.slutSek += hop; });
      k.koerer = false;
      k.halvleg = 2;
      tilfoejHaendelse(k, tidNu, { type: "info", tekst: "▶ 2. halvleg" });
    });
  }

  /* ---------- Registrering ---------- */
  // Tryk på en knap ved en spiller (mål, assist, afbrænder, teknisk fejl, 2 min)
  function registrer(spillerId, type) {
    const tidNu = Date.now();
    const udvId = nytId();
    opdater(d => {
      const k = d.kampdag;
      statsTilRetning(k, spillerId)[KAMP_HANDLINGER[type].felt]++;
      const haendelse = { type, spillerId };
      if (type === "maal") k.hjemme++;
      if (type === "udv") {
        haendelse.udvId = udvId;
        k.udvisninger.push({ id: udvId, spillerId, slutSek: kamptid(k, tidNu) + 120 });   // 2 min = 120 sek
      }
      tilfoejHaendelse(k, tidNu, haendelse);
    });
  }

  function modstanderMaal() {
    const tidNu = Date.now();
    opdater(d => {
      d.kampdag.ude++;
      tilfoejHaendelse(d.kampdag, tidNu, { type: "modmaal" });
    });
  }

  // −1-knapperne retter kun stillingen (fx hvis man har trykket forkert uden at bruge Fortryd)
  function traekFra(felt) {
    opdater(d => { d.kampdag[felt] = Math.max(0, d.kampdag[felt] - 1); });
  }

  // "↶ Fortryd seneste": fjern den sidste hændelse og rul dens effekt tilbage
  function fortrydHaendelse() {
    opdater(d => {
      const k = d.kampdag;
      // Find den seneste hændelse man selv har registreret (spring "🔔 Halvleg" o.l. over)
      let index = k.haendelser.length - 1;
      while (index >= 0 && k.haendelser[index].type === "info") index--;
      if (index < 0) return;
      const [h] = k.haendelser.splice(index, 1);   // tag den ud af listen

      if (KAMP_HANDLINGER[h.type]) {
        const st = statsTilRetning(k, h.spillerId);
        const felt = KAMP_HANDLINGER[h.type].felt;
        st[felt] = Math.max(0, st[felt] - 1);
      }
      if (h.type === "maal") k.hjemme = Math.max(0, k.hjemme - 1);
      if (h.type === "modmaal") k.ude = Math.max(0, k.ude - 1);
      if (h.type === "udv") k.udvisninger = k.udvisninger.filter(u => u.id !== h.udvId);
    });
  }

  /* ---------- Afslut / ny kamp ---------- */
  // "🏁 Afslut kamp og gem": skriv tallene ind i hver spillers historik
  async function afslutKamp() {
    const navn = kampdag.modstander.trim();
    if (!navn) {
      await spoerg("Mangler modstander", "Skriv hvem I spiller mod, før kampen gemmes.", [{ tekst: "OK", svar: true }]);
      modstanderFelt.current?.focus();
      return;
    }
    const medIds = data.spillere.filter(s => erMed(kampdag, s)).map(s => s.id);
    const svar = await spoerg("Afslut kamp?",
      `Vores hold ${kampdag.hjemme} – ${kampdag.ude} ${navn}\n\n` +
      `${medIds.length} spillere får kampen skrevet ind i deres historik.`, [
        { tekst: "Annuller", svar: false },
        { tekst: "🏁 Ja, gem kampen", svar: true, stil: "knap-primaer" },
      ]);
    if (svar !== true) return;

    const tidNu = Date.now();
    opdater(d => {
      const k = d.kampdag;   // de FRISKE data (der kan være sket noget, mens boksen var åben)
      for (const spiller of d.spillere) {
        if (!medIds.includes(spiller.id)) continue;
        const st = statsAf(k, spiller.id);
        spiller.kampe.push({
          id: tidNu + spiller.id,
          dato: k.dato || idagISO(),          // tomt datofelt → dagens dato
          modstander: k.modstander.trim() || navn,
          maal: st.maal,
          assists: st.assists,
          afbraendere: st.afbraendere,
          tekniskeFejl: st.tekniskeFejl,
        });
      }
      d.kampdag = nyKampdag();
    });
    await spoerg("Kampen er gemt ✓",
      "Tallene kan ses under Spillere → Historik og under Oversigt → Vores kampe mod dem.",
      [{ tekst: "OK", svar: true, stil: "knap-primaer" }]);
  }

  async function nyKamp() {
    if (kampdag.haendelser.length > 0) {
      const ok = await bekraeftSlet("Start en ny kamp?",
        "Alt der er registreret i den nuværende kamp forsvinder (det er ikke gemt i historikken).");
      if (!ok) return;
    }
    opdater(d => { d.kampdag = nyKampdag(); });
  }

  /* ---------- Hjælpere til visningen ---------- */
  const findSpiller = id => data.spillere.find(s => s.id === id);

  // Teksten til en hændelse i loggen (React escaper selv teksten – ingen rens() nødvendig)
  function haendelseTekst(h) {
    if (h.type === "info") return h.tekst;
    if (h.type === "modmaal") return `⚽ Mål til ${kampdag.modstander || "modstanderen"}`;
    const spiller = findSpiller(h.spillerId);
    const handling = KAMP_HANDLINGER[h.type];
    if (!handling) return "";
    return `${handling.ikon} ${handling.navn} – ${spiller ? `#${spiller.nummer} ${spiller.navn}` : "(slettet spiller)"}`;
  }

  const kanFortryde = kampdag.haendelser.some(h => h.type !== "info");

  return (
    <main className="side side-kampdag">

      {/* Måltavlen øverst: vores score – uret – modstanderens score */}
      <div className="maaltavle">
        <div className="hold-score">
          <div className="hold-navn">Vores hold</div>
          <div className="score hjemme">{kampdag.hjemme}</div>
          <div className="score-knapper">
            <button className="knap knap-lille" title="Ret stillingen: træk et mål fra" onClick={() => traekFra("hjemme")}>−1</button>
          </div>
        </div>

        <div className="ur-boks">
          <div className="kamp-info">
            <input
              type="date"
              className="lille-input"
              title="Kampens dato"
              value={kampdag.dato}
              onChange={e => { const v = e.target.value; opdater(d => { d.kampdag.dato = v; }); }}
              // Tømmer man datofeltet, bruger vi dagens dato, når man forlader feltet (en kamp skal have en dato)
              onBlur={e => { if (!e.target.value) opdater(d => { d.kampdag.dato = idagISO(); }); }}
            />
            <select
              className="lille-valg"
              title="Hvor lang er en halvleg?"
              value={kampdag.halvlegMin}
              onChange={e => { const v = Number(e.target.value); opdater(d => { d.kampdag.halvlegMin = v; }); }}
            >
              <option value={20}>2 × 20 min</option>
              <option value={25}>2 × 25 min</option>
              <option value={30}>2 × 30 min</option>
            </select>
          </div>
          <div className="halvleg">{kampdag.halvleg}. halvleg</div>
          <div className={"ur" + (kampdag.koerer ? "" : " pause")}>{formatUr(tid)}</div>
          <div className="ur-knapper">
            <button className="knap knap-primaer" onClick={startStopUr}>
              {kampdag.koerer ? "⏸ Stop ur" : "▶ Start ur"}
            </button>
            <button className="knap" onClick={startAndenHalvleg} disabled={kampdag.halvleg === 2}>2. halvleg ▶</button>
          </div>
        </div>

        <div className="hold-score">
          <input
            ref={modstanderFelt}
            type="text"
            className="modstander-input"
            list="kampdag-forslag"
            maxLength={40}
            placeholder="Modstander"
            value={kampdag.modstander}
            onChange={e => { const v = e.target.value; opdater(d => { d.kampdag.modstander = v; }); }}
          />
          {/* Forslag til modstanderens navn: holdene fra Oversigt */}
          <datalist id="kampdag-forslag">
            {data.modstandere.map(h => <option key={h.id} value={h.navn} />)}
          </datalist>
          <div className="score">{kampdag.ude}</div>
          <div className="score-knapper">
            <button className="knap knap-lille" title="Ret stillingen: træk et mål fra" onClick={() => traekFra("ude")}>−1</button>
            <button className="knap knap-fare knap-lille" onClick={modstanderMaal}>⚽ Mål til dem</button>
          </div>
        </div>
      </div>

      <div className="kampdag-gitter">
        {/* Venstre: vores spillere med knapper */}
        <section className="kort">
          <div className="liste-top">
            <div>
              <h2>Vores spillere</h2>
              <p className="opsummering">Tryk på knapperne, når der sker noget. Fjern fluebenet ved spillere, der ikke er med.</p>
            </div>
          </div>
          <div>
            {sorteretTrup(data.spillere).map(spiller => {
              const med = erMed(kampdag, spiller);
              const st = statsAf(kampdag, spiller.id);
              const udvisning = kampdag.udvisninger.find(u => u.spillerId === spiller.id);
              const troeje = spiller.rolle === "MV" ? HJEMME.maalmand : HJEMME.mark;
              return (
                // key: spillerens id, så React kan genkende rækken fra gang til gang
                <div key={spiller.id} className={"kd-spiller" + (med ? "" : " ikke-med") + (udvisning ? " udvist" : "")}>
                  <label className="kd-med" title="Er med i kampen">
                    <input
                      type="checkbox"
                      checked={med}
                      onChange={e => { const v = e.target.checked; opdater(d => { d.kampdag.med[spiller.id] = v; }); }}
                    />
                  </label>
                  <span className="mini-nummer" style={{ background: troeje.farve, color: troeje.tekst }}>{spiller.nummer}</span>
                  <div className="kd-navn">
                    <b>{spiller.navn}</b>
                    {udvisning && <span className="udv-badge">{formatUr(udvisning.slutSek - tid)}</span>}
                    <small>{spiller.rolle} · {st.maal} mål · {st.assists} ass. · {st.afbraendere} afb. · {st.tekniskeFejl} TF</small>
                  </div>
                  <div className="kd-knapper">
                    {Object.entries(KAMP_HANDLINGER).map(([type, h]) => (
                      <button key={type} disabled={!med} onClick={() => registrer(spiller.id, type)}>
                        {h.ikon} {h.navn}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Højre: udvisninger, hændelser og afslut */}
        <section className="kort kampdag-hoejre">
          <h3>⏱ Udvisninger</h3>
          <div>
            {kampdag.udvisninger.length === 0 ? (
              <p className="tom-tekst" style={{ margin: 0, textAlign: "left" }}>Ingen aktive udvisninger.</p>
            ) : kampdag.udvisninger.map(u => {
              const s = findSpiller(u.spillerId);
              return (
                <div className="udv" key={u.id}>
                  <b>#{s ? s.nummer : "?"} {s ? s.navn : ""}</b>
                  <span className="udv-tid">{formatUr(u.slutSek - tid)}</span>
                </div>
              );
            })}
          </div>

          <h3>📜 Hændelser</h3>
          <div>
            <button className="knap knap-lille" onClick={fortrydHaendelse} disabled={!kanFortryde}>↶ Fortryd seneste</button>
          </div>
          <div className="haendelse-liste">
            {kampdag.haendelser.length === 0 ? (
              <p className="tom-tekst">Ingen hændelser endnu.</p>
            ) : [...kampdag.haendelser].reverse().map(h => (   // nyeste øverst
              <div className="haendelse" key={h.id}>
                <span className="tid">{formatUr(h.sek)}</span>{haendelseTekst(h)}
              </div>
            ))}
          </div>

          <div className="kampdag-slut">
            <button className="knap knap-primaer" onClick={afslutKamp}>🏁 Afslut kamp og gem</button>
            <button className="knap" onClick={nyKamp}>Ny kamp</button>
          </div>
        </section>
      </div>
    </main>
  );
}
