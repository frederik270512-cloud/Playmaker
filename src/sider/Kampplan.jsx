/*
  SIDE: KAMPPLAN – én side pr. kamp, som kan printes og tages med i hallen.

  Venstre:  listen med kampplaner (nyeste dato først) + "Ny kampplan"
  Midten:   felterne man udfylder (se kampplan/PlanEditor.jsx)
  Højre:    selve planen som et "ark papir" (se kampplan/PlanVisning.jsx) – det er den, der printes

  AUTOMATISK GEMNING: ligesom på Oversigt gemmes hver ændring med det samme.
  PRINT: knappen kalder window.print(). Kampplan.css har en "@media print"-del,
  der skjuler alt andet end arket, når siden printes.
*/
import { useEffect, useRef, useState } from "react";
import { useData } from "../DataKontekst.jsx";
import { useDialog } from "../komponenter/Dialog.jsx";
import { formatDato } from "../hjaelpere.js";
import { nyKampplan, sikrPlan, sorterPlaner, visTitel } from "./kampplan/kampplanHjaelpere.js";
import PlanEditor from "./kampplan/PlanEditor.jsx";
import PlanVisning from "./kampplan/PlanVisning.jsx";
import "./Kampplan.css";

export default function Kampplan() {
  const { data, opdater } = useData();
  const { bekraeftSlet } = useDialog();

  const [valgtId, setValgtId] = useState(null);
  const [status, setStatus] = useState("");       // "" / "gemmer" / "gemt" (kun til øjet)
  const statusTimer = useRef(null);
  const hoejreBoks = useRef(null);

  // Alle planer i "sikker" form (se kampplanHjaelpere.js), nyeste dato først
  // (planer uden id – fx fra en rettet fil – springes over, for dem kan vi ikke rette i)
  const planer = sorterPlaner(data.kampplaner.filter(p => p.id != null).map(sikrPlan));
  // Den valgte plan – findes den ikke (første gang, eller den er slettet), vælges den øverste
  const plan = planer.find(p => p.id === valgtId) || planer[0] || null;

  // Find modstanderen ud fra id'et (null hvis ingen er valgt, eller holdet er slettet)
  const findModstander = p =>
    p.modstanderId == null ? null : data.modstandere.find(h => String(h.id) === String(p.modstanderId)) || null;
  const modstander = plan ? findModstander(plan) : null;

  // Skifter man plan, nulstilles "Gemt ✓"-teksten
  const planId = plan ? plan.id : null;
  useEffect(() => {
    clearTimeout(statusTimer.current);
    setStatus("");
  }, [planId]);
  useEffect(() => () => clearTimeout(statusTimer.current), []);   // oprydning når siden forsvinder

  /* ---------- Ret et felt på den valgte plan ---------- */
  function saetFelt(egenskab, vaerdi) {
    const id = plan.id;   // husk id'et NU – så ændringen altid lander på den rigtige plan
    opdater(d => {
      const p = d.kampplaner.find(x => x.id === id);
      if (p) p[egenskab] = vaerdi;
    });
    setStatus("gemmer");
    clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(() => setStatus("gemt"), 500);
  }

  function vaelgPlan(id) {
    setValgtId(id);
    // På smalle skærme ligger planen under listen – rul ned til den
    if (window.innerWidth <= 1000 && hoejreBoks.current) {
      hoejreBoks.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  /* ---------- + Ny kampplan ---------- */
  function nyPlan() {
    const ny = nyKampplan();
    opdater(d => { d.kampplaner.push(ny); });
    vaelgPlan(ny.id);
  }

  /* ---------- 🗑 Slet plan ---------- */
  async function sletPlan() {
    if (!plan) return;
    const id = plan.id;
    if (!(await bekraeftSlet(`Slet "${visTitel(plan, modstander)}"?`, "Kampplanen bliver slettet. Det kan ikke fortrydes."))) return;
    opdater(d => { d.kampplaner = d.kampplaner.filter(p => p.id !== id); });
    setValgtId(null);   // så vælges den øverste automatisk
  }

  return (
    <main className="side side-kampplan">

      {/* Venstre: listen med kampplaner */}
      <section className="kort kp-liste">
        <div className="liste-top">
          <div>
            <h2>Kampplaner</h2>
            <p className="opsummering">{planer.length === 1 ? "1 plan" : `${planer.length} planer`}</p>
          </div>
          <button className="knap knap-primaer" onClick={nyPlan}>+ Ny kampplan</button>
        </div>
        <div className="hold-liste">
          {planer.length === 0 && <p className="tom-tekst">Ingen kampplaner endnu.</p>}
          {planer.map(p => {
            const h = findModstander(p);
            return (
              <button key={p.id} className={"hold-punkt" + (plan && p.id === plan.id ? " aktiv" : "")}
                      onClick={() => vaelgPlan(p.id)}>
                <b>{visTitel(p, h)}</b>
                <small>{formatDato(p.dato)}{h ? " · " + (h.navn || "Unavngivet hold") : ""}</small>
              </button>
            );
          })}
        </div>
      </section>

      {/* Højre: redigering + selve planen */}
      <div className="kp-hoejre" ref={hoejreBoks}>
        {!plan ? (
          <section className="kort">
            <p className="tom-tekst" style={{ marginTop: 40 }}>Vælg en kampplan – eller lav en ny.</p>
          </section>
        ) : (
          <>
            <section className="kort kp-editor">
              <div className="kp-editor-top">
                <h2>✏️ Rediger</h2>
                <span className={"gem-status" + (status === "gemt" ? " gemt" : "")}>
                  {status === "gemmer" ? "Gemmer…" : status === "gemt" ? "Gemt ✓" : ""}
                </span>
                <button className="knap knap-fare knap-lille" onClick={sletPlan}>🗑 Slet</button>
              </div>
              <p className="hjaelp">Alt bliver gemt automatisk.</p>
              {/* key={plan.id}: editoren starter forfra, når man skifter plan */}
              <PlanEditor key={plan.id} plan={plan} modstander={modstander} saetFelt={saetFelt} />
            </section>

            <section className="kp-ark-ramme">
              <div className="kp-ark-knapper">
                <span className="hjaelp">Sådan ser planen ud på papir:</span>
                <button className="knap knap-primaer" onClick={() => window.print()}>🖨️ Print</button>
              </div>
              <PlanVisning plan={plan} modstander={modstander}
                           spillere={data.spillere} systemer={data.systemer} />
            </section>
          </>
        )}
      </div>
    </main>
  );
}
