/*
  QUIZ – "Hvor skal spilleren løbe?"

  Man ser banen, som den står i et trin. Én af vores spillere lyser op (gul ring),
  og man trækker ham derhen, hvor man tror, han løber i NÆSTE trin. Når man trykker
  "✓ Svar", ser man hvor tæt man var, og det rigtige løb bliver afspillet.

  Quizzen ÆNDRER ALDRIG systemet. Gættet ligger kun i komponentens egen state (useState),
  og systemet bliver kun læst – derfor kan den ikke ødelægge noget i data.systemer.

  Props:
    system          – det EFFEKTIVE system (fælles trin + den valgte variant, se systemVarianter.js)
    spillerNavn(noegle) – navnet på spilleren på pladsen (fra taktiktavlen), eller ""
    trinNavn(index) – navnet på et trin, fx "3" eller "4A"
    onAfslut()      – luk quizzen (tilbage til almindelig visning)

  Quizzen har fire "faser" (hvilken skærm man ser):
    "gaet"    – man trækker spilleren og trykker Svar
    "svar"    – man ser ✓/✗, afstanden og det rigtige løb
    "faerdig" – alle spørgsmål er besvaret
    "tom"     – systemet har ingen løb at gætte
*/
import { useEffect, useMemo, useRef, useState } from "react";
import BaneSVG from "../../komponenter/BaneSVG.jsx";
import { SystemFigur } from "../../komponenter/Figur.jsx";
import { Pil, PileLag } from "../../komponenter/Pile.jsx";
import { voresNoegler, erVores, erForsvarssystem, brikNavn, rolleInfo } from "../../systemRoller.js";
import { tilstandVed, boldPosition, boldPunkt } from "../../animation.js";
import { tilProcentI, skaermTilBaneI, begraens, decimal, baneViewBox, viewBoxTekst, bundGraense } from "../../hjaelpere.js";

// Banens enheder: 10 enheder = 1 meter
const MIN_LOEB = 15;          // et løb skal være mindst 1,5 m for at blive et spørgsmål
const RIGTIGT_GRAENSE = 20;   // er man højst 2 m fra, tæller det som rigtigt
const ANIMATION_SEK = 1.6;    // så lang tid tager det at afspille det rigtige løb

/*
  Byg listen af spørgsmål. For hvert trin k (fra trin nr. 1, dvs. det ANDET trin)
  finder vi den af vores spillere, der flytter sig MEST fra trin k-1 til trin k.
  "Vores spillere" er angriberne i et angrebssystem og forsvarsspillerne i et
  forsvarssystem (se voresNoegler i systemRoller.js).
  Flytter han sig under 1,5 m, er der ikke noget at gætte – så springer vi trinet over.
  Funktionen er "ren": den læser kun systemet og giver en ny liste tilbage.
*/
export function bygSpoergsmaal(system) {
  const liste = [];
  for (let k = 1; k < system.trin.length; k++) {
    const fra = system.trin[k - 1].pos;
    const til = system.trin[k].pos;
    let bedst = null;
    let laengst = 0;
    for (const noegle of voresNoegler(system, system.trin[k - 1])) {
      if (!fra[noegle] || !til[noegle]) continue;
      const afstand = Math.hypot(til[noegle].x - fra[noegle].x, til[noegle].y - fra[noegle].y);
      if (afstand > laengst) {
        laengst = afstand;
        bedst = noegle;
      }
    }
    if (bedst && laengst >= MIN_LOEB) liste.push({ trinIndex: k, noegle: bedst });
  }
  return liste;
}

export default function Quiz({ system, spillerNavn, trinNavn, onAfslut }) {
  /*
    useMemo: regn kun spørgsmålene ud igen, hvis systemet ændrer sig –
    ikke ved hver eneste tegning (fx 60 gange i sekundet under animationen).
  */
  const spoergsmaal = useMemo(() => bygSpoergsmaal(system), [system]);

  // Hel bane (kontra)? Så bruger vi den hele banes koordinater (se helBane.js)
  const helBane = system.helBane === true;
  const vb = baneViewBox(helBane);
  const tilProcent = (x, y) => tilProcentI(vb, x, y);
  const skaermTilBane = (element, x, y) => skaermTilBaneI(vb, element, x, y);

  const [nr, setNr] = useState(0);              // hvilket spørgsmål (0 = det første)
  const [fase, setFase] = useState("gaet");
  const [gaet, setGaet] = useState(null);       // hvor man har sat spilleren, eller null
  const [animTid, setAnimTid] = useState(0);    // "tid" i animationen af det rigtige løb
  const [trukket, setTrukket] = useState(false);

  // useRef til banens <div> (til at omregne pixels → banens koordinater)
  const baneRef = useRef(null);
  // Det træk der er i gang – skal ikke vises, så en ref er nok
  const traek = useRef(null);

  const spm = spoergsmaal[nr] ?? null;
  // Hvilken skærm skal vises? (Uden spørgsmål → "tom". Er vi forbi det sidste → "faerdig".)
  const visFase = spoergsmaal.length === 0 ? "tom" : !spm ? "faerdig" : fase;

  /*
    Afspil det RIGTIGE løb, når man har svaret: tiden går fra trin k-1 til trin k.
    requestAnimationFrame kalder animer() før hvert nyt billede på skærmen.
    Oprydningen (return) stopper animationen, hvis man trykker Næste/Afslut midt i den,
    eller hvis quizzen lukkes – ellers ville den blive ved med at sætte state.
  */
  useEffect(() => {
    if (fase !== "svar" || !spm) return;
    const k = spm.trinIndex;
    let start = null;
    let anmodning = 0;
    function animer(nu) {
      if (start === null) start = nu;
      const andel = Math.min(1, (nu - start) / (ANIMATION_SEK * 1000));   // 0 → 1
      setAnimTid(k - 1 + andel);
      if (andel < 1) anmodning = requestAnimationFrame(animer);           // færdig ved 1 = trin k
    }
    anmodning = requestAnimationFrame(animer);
    return () => cancelAnimationFrame(anmodning);
  }, [fase, spm]);

  /* ---------- Træk den spurgte spiller (Pointer Events: mus, pen og finger) ---------- */

  function brikNed(e) {
    if (visFase !== "gaet") return;
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* virker også uden */ }
    const nu = gaet ?? system.trin[spm.trinIndex - 1].pos[spm.noegle];
    const mus = skaermTilBane(baneRef.current, e.clientX, e.clientY);
    traek.current = {
      startMus: { x: e.clientX, y: e.clientY },
      // Afstanden fra musen til brikkens midte, så brikken ikke "hopper", når man griber den
      forskydning: { x: nu.x - mus.x, y: nu.y - mus.y },
      erFlyttet: false,
    };
  }

  function brikFlyt(e) {
    const tr = traek.current;
    if (!tr) return;
    // Under 4 pixels tæller ikke som et træk (så et lille ryk ikke "svarer" for en)
    if (!tr.erFlyttet && Math.hypot(e.clientX - tr.startMus.x, e.clientY - tr.startMus.y) < 4) return;
    if (!tr.erFlyttet) {
      tr.erFlyttet = true;
      setTrukket(true);
    }
    const p = skaermTilBane(baneRef.current, e.clientX, e.clientY);
    // begraens = hold brikken inde på (og lige omkring) banen
    setGaet({
      x: begraens(p.x + tr.forskydning.x, -10, 210),
      y: begraens(p.y + tr.forskydning.y, -20, bundGraense(helBane)),
    });
  }

  // pointerup OG pointercancel (fx hvis browseren afbryder et touch-træk) afslutter trækket
  function brikOp() {
    traek.current = null;
    setTrukket(false);
  }

  /* ---------- Knapperne ---------- */

  function svar() {
    if (!gaet || !spm) return;
    traek.current = null;
    setTrukket(false);
    setAnimTid(spm.trinIndex - 1);   // animationen starter fra trin k-1
    setFase("svar");
  }

  function naeste() {
    setGaet(null);
    setFase("gaet");
    setNr(nr + 1);                   // efter det sidste spørgsmål bliver spm null → "faerdig"
  }

  function proevIgen() {
    setGaet(null);
    setFase("gaet");
    setNr(0);
  }

  /* ---------- Hvad står hvor på banen lige nu? ---------- */

  let pos;          // alle brikkernes positioner
  let bp;           // boldens position
  let skilt;        // skiltet øverst til venstre
  if (visFase === "gaet") {
    // Trinet FØR løbet – stille, uden pile. Den spurgte spiller står hvor man har sat ham.
    const fra = system.trin[spm.trinIndex - 1];
    pos = gaet ? { ...fra.pos, [spm.noegle]: gaet } : fra.pos;   // ny kopi – fra.pos røres ikke
    bp = boldPunkt(fra.bold, pos);
    skilt = `Spørgsmål ${nr + 1} af ${spoergsmaal.length} · Trin ${trinNavn(spm.trinIndex - 1)}`;
  } else {
    // Svar / færdig / tom: brug animationens tilstand (ved "tom" står vi bare på trin 1)
    const t = tilstandVed(system, visFase === "tom" ? 0 : animTid);
    pos = t.pos;
    bp = boldPosition(t);
    skilt = visFase === "svar"
      ? `Trin ${trinNavn(spm.trinIndex - 1)} → ${trinNavn(spm.trinIndex)}`
      : visFase === "faerdig" ? "🎉 Færdig" : `Trin ${trinNavn(0)}`;
  }

  // Resultatet af svaret (kun i fasen "svar")
  let resultat = null;
  if (visFase === "svar" && gaet) {
    const rigtig = system.trin[spm.trinIndex].pos[spm.noegle];
    const afstand = Math.hypot(gaet.x - rigtig.x, gaet.y - rigtig.y);
    resultat = { rigtig, afstand, rigtigt: afstand <= RIGTIGT_GRAENSE };
  }

  // Forsvarssystem? Så spørger vi om VORE forsvarsspillere (se systemRoller.js)
  const forsvar = erForsvarssystem(system);

  // "VB (Mads)" – eller bare "VB", hvis ingen spiller står på pladsen.
  // I et forsvarssystem: "forsvarer 3" / "målmanden" (der bruges ingen navne fra tavlen).
  function spillerTekst(noegle) {
    if (forsvar) return brikNavn(noegle);
    const navn = spillerNavn(noegle);
    return navn ? `${noegle} (${navn})` : noegle;
  }

  const trinTekst = spm ? system.trin[spm.trinIndex]?.tekst || "" : "";

  return (
    <>
      {/* "laast" giver de normale brikker en almindelig markør og gør bolden u-gribelig */}
      <div ref={baneRef} className={"system-bane laast quiz-bane" + (helBane ? " hel" : "")}>
        {/* Banen SKAL være det første barn (CSS giver den skygge) */}
        <BaneSVG helBane={helBane} forsvar={erForsvarssystem(system)} />

        {/* Efter svaret: en stiplet pil fra gættet til det rigtige sted (grøn = rigtigt, rød = forkert) */}
        {resultat && (
          <PileLag viewBox={viewBoxTekst(vb)}>
            <Pil a={gaet} b={resultat.rigtig} farve={resultat.rigtigt ? "#22c55e" : "#ef4444"} stiplet />
          </PileLag>
        )}

        <div className="bold" style={tilProcent(bp.x, bp.y)} />
        <div className="trin-skilt">{skilt}</div>

        {/* En halvgennemsigtig "skygge" der viser, hvor man gættede */}
        {resultat && (
          <div className="sbrik quiz-gaet-maerke" style={tilProcent(gaet.x, gaet.y)} aria-hidden="true">
            <SystemFigur noegle={spm.noegle} forsvar={forsvar} />
          </div>
        )}

        {Object.keys(system.trin[0].pos).map((noegle) => {
          const p = pos[noegle];
          if (!p) return null;
          // "modst" = modstanderen (M-nøglerne i angreb, angriberne i forsvar)
          const modst = !erVores(system, noegle);
          const spurgt = spm && noegle === spm.noegle && (visFase === "gaet" || visFase === "svar");
          // KUN den spurgte spiller kan trækkes, og kun mens man gætter
          const kanTraekkes = spurgt && visFase === "gaet";
          // Navne fra tavlen kun på vores angribere i et angrebssystem
          const navn = modst || forsvar ? "" : spillerNavn(noegle);
          const klasse = "sbrik" + (modst ? " modst" : "") + (spurgt ? " quiz-spurgt" : "") +
                         (kanTraekkes ? " quiz-traekbar" : "") + (kanTraekkes && trukket ? " trukket" : "");
          return (
            <div
              key={noegle}
              className={klasse}
              style={tilProcent(p.x, p.y)}
              title={kanTraekkes
                ? `Træk ${spillerTekst(noegle)} derhen, hvor du tror han løber`
                : modst ? "" : forsvar ? brikNavn(noegle) : rolleInfo(noegle).navn}
              // Event-handlerne sættes kun på den brik, der må trækkes
              onPointerDown={kanTraekkes ? brikNed : undefined}
              onPointerMove={kanTraekkes ? brikFlyt : undefined}
              onPointerUp={kanTraekkes ? brikOp : undefined}
              onPointerCancel={kanTraekkes ? brikOp : undefined}
            >
              <SystemFigur noegle={noegle} forsvar={forsvar} />
              {navn && <span className="sbrik-navn">{navn}</span>}
            </div>
          );
        })}
      </div>

      {/* Bjælken under banen: spørgsmål, svar eller "færdig" (genbruger .trin-tekst) */}
      {visFase === "gaet" && (
        <div className="trin-tekst quiz-bjaelke">
          <div>
            <b>🎯 Spørgsmål {nr + 1} af {spoergsmaal.length}:</b>{" "}
            {forsvar
              ? `Hvor flytter ${spillerTekst(spm.noegle)} hen?`
              : `Hvor løber ${spillerTekst(spm.noegle)} hen?`}
          </div>
          <div className="quiz-hjaelp">
            {gaet
              ? "Flyt ham igen, eller tryk Svar."
              : `Træk ${forsvar ? spillerTekst(spm.noegle) : spm.noegle} derhen, hvor du tror han ${forsvar ? "flytter" : "løber"}.`}
          </div>
          <div className="quiz-knapper">
            <button className="knap" onClick={onAfslut}>Afslut quiz</button>
            <button className="knap knap-primaer" disabled={!gaet} onClick={svar}>✓ Svar</button>
          </div>
        </div>
      )}

      {visFase === "svar" && resultat && (
        <div className={"trin-tekst quiz-bjaelke " + (resultat.rigtigt ? "quiz-rigtigt" : "quiz-forkert")}>
          <div className="quiz-resultat">
            {resultat.rigtigt
              ? `✓ Rigtigt! Du var ${decimal(resultat.afstand / 10)} m fra`
              : `✗ Ikke helt – du var ${decimal(resultat.afstand / 10)} m fra`}
          </div>
          {trinTekst && <div>💬 {trinTekst}</div>}
          <div className="quiz-knapper">
            <button className="knap" onClick={onAfslut}>Afslut quiz</button>
            <button className="knap knap-primaer" onClick={naeste}>Næste ▶</button>
          </div>
        </div>
      )}

      {visFase === "faerdig" && (
        <div className="trin-tekst quiz-bjaelke">
          <div className="quiz-resultat">🎉 Quizzen er færdig</div>
          <div className="quiz-knapper">
            <button className="knap" onClick={onAfslut}>Afslut quiz</button>
            <button className="knap knap-primaer" onClick={proevIgen}>↺ Prøv igen</button>
          </div>
        </div>
      )}

      {visFase === "tom" && (
        <div className="trin-tekst quiz-bjaelke">
          <div>Der er ingen løb at gætte i dette system.</div>
          <div className="quiz-hjaelp">
            Et spørgsmål kræver, at en af vores spillere løber mindst 1,5 m fra ét trin til det næste.
          </div>
          <div className="quiz-knapper">
            <button className="knap knap-primaer" onClick={onAfslut}>← Tilbage</button>
          </div>
        </div>
      )}
    </>
  );
}
