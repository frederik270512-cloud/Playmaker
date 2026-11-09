/*
  SIDE 4: OVERSIGT – scouting af de modstanderhold vi møder.

  Venstre:  listen med modstanderhold (+ Nyt hold)
  Højre:    alt om det valgte hold – styrker, forsvar, nøglespillere, noter
            og "Vores kampe mod dem" (regnes ud fra vores spilleres historik).

  AUTOMATISK GEMNING: hvert tastetryk kalder opdater(), som retter i de fælles
  data og gemmer dem med det samme (data er små, så det er helt fint).
  Teksten "Gemmer…" / "Gemt ✓" er kun til øjet – den skifter til "Gemt ✓"
  et halvt sekund efter, man er holdt op med at skrive.
*/
import { useEffect, useRef, useState } from "react";
import { useData } from "../DataKontekst.jsx";
import { useDialog } from "../komponenter/Dialog.jsx";
import { ModstanderFigur } from "../komponenter/Figur.jsx";
import RolleChip from "../komponenter/RolleChip.jsx";
import { ROLLER } from "../data/konstanter.js";
import { formatDato, nytId } from "../hjaelpere.js";

// Et tomt "tilføj nøglespiller"-skema
const TOM_NOEGLE = { nummer: "", navn: "", position: "", note: "" };

export default function Oversigt() {
  const { data, opdater } = useData();
  const { bekraeftSlet } = useDialog();

  // useState: hvilket hold er valgt? (id – eller null)
  const [valgtId, setValgtId] = useState(null);
  // "" = ingen tekst, "gemmer" = man skriver, "gemt" = færdig
  const [status, setStatus] = useState("");
  // Skemaet til en ny nøglespiller (et "kontrolleret" skema: React styrer felternes værdi)
  const [ny, setNy] = useState(TOM_NOEGLE);

  // useRef: en "kasse" der husker noget mellem tegninger UDEN at tegne siden forfra.
  // Her bruger vi dem til at få fat i HTML-elementer og til stop-uret.
  const navnFelt = useRef(null);
  const nummerFelt = useRef(null);
  const scoutBoks = useRef(null);
  const statusTimer = useRef(null);
  const markerNavn = useRef(false);     // skal navnefeltet markeres efter næste tegning?

  const modstandere = data.modstandere;
  // Det valgte hold. Findes det ikke (første gang, eller det er slettet), vælges det første.
  const hold = modstandere.find(h => h.id === valgtId) || modstandere[0] || null;

  // Når holdet skifter: nulstil status-teksten og stop et evt. kørende stop-ur.
  // (Selve teksten i felterne kommer altid fra det rigtige hold, fordi felterne
  //  læser direkte fra "hold" – så man kan aldrig skrive i det forkerte hold.)
  const holdId = hold ? hold.id : null;
  useEffect(() => {
    clearTimeout(statusTimer.current);
    setStatus("");
    // Lige oprettet hold? Så marker navnet, så man bare kan skrive det rigtige.
    if (markerNavn.current && navnFelt.current) {
      navnFelt.current.focus();
      navnFelt.current.select();
      markerNavn.current = false;
    }
  }, [holdId]);

  // Oprydning: når siden forsvinder (skift af fane), stoppes stop-uret
  useEffect(() => () => clearTimeout(statusTimer.current), []);

  /* ---------- Ret et felt på det valgte hold ---------- */
  function saetFelt(egenskab, vaerdi) {
    const id = hold.id;   // husk id'et NU – så ændringen altid lander på det rigtige hold
    opdater(d => {
      const h = d.modstandere.find(x => x.id === id);
      if (h) h[egenskab] = vaerdi;
    });
    setStatus("gemmer");
    clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(() => setStatus("gemt"), 500);
  }

  /* ---------- Vælg et hold i listen ---------- */
  function vaelgHold(id) {
    setValgtId(id);
    // På smalle skærme ligger detaljerne under listen – rul ned til dem
    if (window.innerWidth <= 1000 && scoutBoks.current) {
      scoutBoks.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  /* ---------- + Nyt hold ---------- */
  function nytHold() {
    const id = nytId();
    opdater(d => {
      d.modstandere.push({ id, navn: "Nyt hold", forsvar: "", styrker: "", opmaerksom: "", noter: "", noeglespillere: [] });
    });
    markerNavn.current = true;   // effekten ovenfor markerer navnet, når holdet er tegnet
    setValgtId(id);
  }

  /* ---------- 🗑 Slet hold ---------- */
  async function sletHold() {
    if (!hold) return;
    const id = hold.id;
    if (!(await bekraeftSlet(`Slet ${hold.navn}?`,
        "Alle noter og nøglespillere for holdet bliver slettet. Det kan ikke fortrydes."))) return;
    opdater(d => { d.modstandere = d.modstandere.filter(h => h.id !== id); });
    setValgtId(null);   // så vælges det første hold automatisk
  }

  /* ---------- Nøglespillere ---------- */
  function tilfoejNoeglespiller(e) {
    e.preventDefault();             // undgå at browseren genindlæser siden
    if (!hold) return;
    const id = hold.id;
    const spiller = {
      id: nytId(),
      nummer: Number(ny.nummer),
      navn: ny.navn.trim(),
      position: ny.position,
      note: ny.note.trim(),
    };
    opdater(d => {
      const h = d.modstandere.find(x => x.id === id);
      if (h) h.noeglespillere.push(spiller);
    });
    setNy(TOM_NOEGLE);
    nummerFelt.current?.focus();    // klar til at skrive den næste
  }

  async function fjernNoeglespiller(sp) {
    const id = hold.id;
    if (!(await bekraeftSlet(`Fjern ${sp.navn}?`,
        `#${sp.nummer} ${sp.navn} bliver fjernet fra listen over nøglespillere.`))) return;
    opdater(d => {
      const h = d.modstandere.find(x => x.id === id);
      if (h) h.noeglespillere = h.noeglespillere.filter(x => x.id !== sp.id);
    });
  }

  // Listen til venstre, sorteret alfabetisk (localeCompare med "da" sorterer æ, ø, å rigtigt)
  const sorteret = [...modstandere].sort((a, b) => a.navn.localeCompare(b.navn, "da"));

  return (
    <main className="side side-oversigt">

      {/* Venstre: listen med modstanderhold */}
      <section className="kort">
        <div className="liste-top">
          <div>
            <h2>Modstandere</h2>
            <p className="opsummering">{modstandere.length === 1 ? "1 hold" : `${modstandere.length} hold`}</p>
          </div>
          <button className="knap knap-primaer" onClick={nytHold}>+ Nyt hold</button>
        </div>
        <div className="hold-liste">
          {modstandere.length === 0 && <p className="tom-tekst">Ingen hold endnu.</p>}
          {/* key: React bruger den til at holde styr på hvert punkt i listen */}
          {sorteret.map(h => (
            <button
              key={h.id}
              className={"hold-punkt" + (hold && h.id === hold.id ? " aktiv" : "")}
              onClick={() => vaelgHold(h.id)}
            >
              <b>{h.navn || "Unavngivet hold"}</b>
              <small>{h.forsvar ? h.forsvar + "-forsvar · " : ""}{h.noeglespillere.length} nøglespillere</small>
            </button>
          ))}
        </div>
      </section>

      {/* Højre: alt om det valgte hold */}
      <section className="kort scout" ref={scoutBoks}>
        {!hold ? (
          <p className="tom-tekst" style={{ marginTop: 40 }}>Vælg et hold – eller opret et nyt.</p>
        ) : (
          <div>
            <div className="scout-top">
              {/* Holdnavnet er et stort tekstfelt, man kan skrive direkte i */}
              <input
                ref={navnFelt}
                type="text"
                className="titel-input"
                maxLength={40}
                placeholder="Holdnavn"
                value={hold.navn}
                onChange={e => saetFelt("navn", e.target.value)}
              />
              <span className={"gem-status" + (status === "gemt" ? " gemt" : "")}>
                {status === "gemmer" ? "Gemmer…" : status === "gemt" ? "Gemt ✓" : ""}
              </span>
              <button className="knap knap-fare" onClick={sletHold}>🗑 Slet hold</button>
            </div>
            <p className="hjaelp" style={{ paddingLeft: 9 }}>Alt bliver gemt automatisk, mens du skriver.</p>

            <div className="scout-gitter">
              <label className="felt">💪 Det er de gode til
                <textarea rows={4} placeholder="f.eks. Hurtige kontraangreb, stærke i 1 mod 1"
                          value={hold.styrker} onChange={e => saetFelt("styrker", e.target.value)} />
              </label>
              <label className="felt">⚠️ Vær opmærksom på
                <textarea rows={4} placeholder="f.eks. Deres #7 skyder hårdt fra 9 meter"
                          value={hold.opmaerksom} onChange={e => saetFelt("opmaerksom", e.target.value)} />
              </label>
            </div>
            <label className="felt" style={{ marginTop: 14, maxWidth: 260 }}>🛡️ Forsvar de plejer at spille
              <select value={hold.forsvar} onChange={e => saetFelt("forsvar", e.target.value)}>
                <option value="">Ved ikke</option>
                <option value="6-0">6-0</option>
                <option value="5-1">5-1</option>
                <option value="3-2-1">3-2-1</option>
              </select>
            </label>

            <h3>⭐ Nøglespillere – dem der er gode</h3>
            <Noeglespillere hold={hold} onFjern={fjernNoeglespiller} />

            <form className="skade-form" onSubmit={tilfoejNoeglespiller}>
              <div className="felt-raekke">
                <label className="felt" style={{ flex: "0 0 80px" }}>Nr.
                  <input ref={nummerFelt} type="number" min="1" max="99" required
                         value={ny.nummer} onChange={e => setNy({ ...ny, nummer: e.target.value })} />
                </label>
                <label className="felt">Navn
                  <input type="text" maxLength={30} required
                         value={ny.navn} onChange={e => setNy({ ...ny, navn: e.target.value })} />
                </label>
                <label className="felt" style={{ flex: "0 0 170px" }}>Position
                  <select value={ny.position} onChange={e => setNy({ ...ny, position: e.target.value })}>
                    <option value="">Ukendt</option>
                    {Object.keys(ROLLER).map(kode => (
                      <option key={kode} value={kode}>{kode} – {ROLLER[kode].navn}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="felt">Hvad skal vi passe på?
                <input type="text" maxLength={150} placeholder="f.eks. Venstrehåndet, skyder hårdt fra 9 m"
                       value={ny.note} onChange={e => setNy({ ...ny, note: e.target.value })} />
              </label>
              <button type="submit" className="knap">+ Tilføj nøglespiller</button>
            </form>

            <h3>📝 Noter</h3>
            <textarea className="noter" rows={6} placeholder="Skriv dine egne noter om holdet her…"
                      value={hold.noter} onChange={e => saetFelt("noter", e.target.value)} />

            <h3>📊 Vores kampe mod dem</h3>
            <KampeMod hold={hold} spillere={data.spillere} />
          </div>
        )}
      </section>
    </main>
  );
}

/* ---------- Listen med nøglespillere (sorteret efter nummer) ---------- */
function Noeglespillere({ hold, onFjern }) {
  if (hold.noeglespillere.length === 0) {
    return <p className="tom-tekst" style={{ textAlign: "left" }}>Ingen nøglespillere tilføjet endnu.</p>;
  }
  return (
    <div>
      {[...hold.noeglespillere].sort((a, b) => a.nummer - b.nummer).map(sp => (
        <div className="noegle" key={sp.id}>
          {/* Modstanderens trøje – målmanden med lange ærmer */}
          <div className="noegle-figur">
            <ModstanderFigur tekst={sp.nummer} maalmand={sp.position === "MV"} />
          </div>
          <div className="noegle-tekst">
            <b>#{sp.nummer} {sp.navn}</b> {sp.position && <RolleChip kode={sp.position} />}
            {sp.note && <div className="noegle-note">{sp.note}</div>}
          </div>
          <button className="slet-x" title="Fjern" onClick={() => onFjern(sp)}>×</button>
        </div>
      ))}
    </div>
  );
}

/*
  "Vores kampe mod dem": vi kigger alle VORE spilleres kampe igennem og finder
  dem, hvor modstanderen hedder det samme som holdet. Kampene samles pr. dato.
*/
function KampeMod({ hold, spillere }) {
  const holdnavn = hold.navn.trim().toLowerCase();
  const perDato = {};   // { "2026-10-26": { dato, maal, scorere: [ {navn, maal} ] } }

  for (const spiller of spillere) {
    for (const kamp of spiller.kampe) {
      if (!holdnavn || kamp.modstander.trim().toLowerCase() !== holdnavn) continue;
      if (!perDato[kamp.dato]) perDato[kamp.dato] = { dato: kamp.dato, maal: 0, scorere: [] };
      perDato[kamp.dato].maal += kamp.maal;
      if (kamp.maal > 0) perDato[kamp.dato].scorere.push({ navn: spiller.navn, maal: kamp.maal });
    }
  }

  const kampe = Object.values(perDato).sort((a, b) => String(b.dato).localeCompare(String(a.dato)));
  if (kampe.length === 0) {
    return (
      <p className="tom-tekst" style={{ textAlign: "left" }}>
        Ingen registrerede kampe mod {hold.navn || "holdet"}. Kampe tilføjes under Spillere → Historik.
      </p>
    );
  }
  return (
    <div>
      {kampe.map(k => {
        const top = [...k.scorere].sort((a, b) => b.maal - a.maal)[0];   // den der scorede mest
        return (
          <div className="kamp-linje" key={k.dato}>
            <b>{formatDato(k.dato)}</b> · {k.maal} mål registreret
            {top && <small>Topscorer: {top.navn} ({top.maal} mål)</small>}
          </div>
        );
      })}
    </div>
  );
}
