/*
  SYSTEM-OVERSIGT – alle gemte systemer som kort (det man ser først på Systemer-siden).

  Props (det komponenten får fra Systemer.jsx):
    onAabn(id)  – åbn et gemt system
    onNyt()     – lav et nyt system
*/
import { useData } from "../../DataKontekst.jsx";
import { useDialog } from "../../komponenter/Dialog.jsx";
import MiniBane from "./MiniBane.jsx";

export default function SystemOversigt({ onAabn, onNyt }) {
  const { data, opdater } = useData();
  const { bekraeftSlet } = useDialog();
  const systemer = data.systemer;

  async function sletSystem(e, system) {
    // stopPropagation: klikket må ikke OGSÅ nå ud til kortet (så ville systemet åbne)
    e.stopPropagation();
    if (!(await bekraeftSlet(`Slet "${system.navn}"?`,
        `Systemet og alle dets ${system.trin.length} trin bliver slettet. Det kan ikke fortrydes.`))) return;
    opdater(d => { d.systemer = d.systemer.filter(s => s.id !== system.id); });
  }

  return (
    <div className="system-oversigt">
      <div className="liste-top">
        <div>
          <h2>Mine systemer</h2>
          <p className="opsummering">
            {systemer.length === 1 ? "1 gemt system" : `${systemer.length} gemte systemer`}
          </p>
        </div>
        <button className="knap knap-primaer" onClick={onNyt}>+ Nyt system</button>
      </div>

      <div className="system-gitter">
        {/* key={s.id}: React bruger nøglen til at holde styr på, hvilket kort der er hvilket */}
        {systemer.map(s => (
          <div key={s.id} className="system-kort" onClick={() => onAabn(s.id)}>
            <MiniBane system={s} />
            <div className="system-kort-tekst">
              <h3>{s.navn}</h3>
              <p>{s.beskrivelse || "Ingen beskrivelse"}</p>
              <div className="meta">
                {s.trin.length} trin · {s.forsvar ? s.forsvar + "-forsvar" : "uden forsvar"}
              </div>
            </div>
            <button className="kort-slet" title="Slet system" onClick={(e) => sletSystem(e, s)}>🗑</button>
          </div>
        ))}

        {/* Et ekstra kort til sidst: "+ Nyt system" */}
        <div className="system-kort nyt-kort" onClick={onNyt}>
          <span>+</span>Nyt system
        </div>
      </div>
    </div>
  );
}
