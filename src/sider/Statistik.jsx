/*
  SIDE 7: STATISTIK – holdets og spillernes tal samlet ét sted.

  Fire kort:
    🏆 Topscorer-liste          – hele truppen i en tabel, der kan sorteres   (statistik/Topscorere.jsx)
    📈 Udvikling over tid       – en graf for én spiller, kamp for kamp        (statistik/Udvikling.jsx)
    🤾 Holdets resultater       – alle kampe med stilling og V/U/T             (statistik/Resultater.jsx)
    🎯 Personlige mål           – mål for hver spiller med fremskridtsbjælke   (statistik/PersonligeMaal.jsx)

  Alle udregninger ligger i statistik/beregning.js, så komponenterne kun skal tegne.
  Siden LÆSER kun data – bortset fra de personlige mål, som gemmes med opdater().
*/
import Topscorere from "./statistik/Topscorere.jsx";
import Udvikling from "./statistik/Udvikling.jsx";
import Resultater from "./statistik/Resultater.jsx";
import PersonligeMaal from "./statistik/PersonligeMaal.jsx";
import "./Statistik.css";

export default function Statistik() {
  return (
    <main className="side side-statistik">
      <section className="kort stat-kort stat-bred">
        <div className="liste-top">
          <div>
            <h2>🏆 Topscorer-liste</h2>
            <p className="opsummering">Klik på en overskrift for at sortere. Top 3 målscorere er fremhævet.</p>
          </div>
        </div>
        <Topscorere />
      </section>

      <section className="kort stat-kort stat-bred">
        <div className="liste-top">
          <div>
            <h2>📈 Udvikling over tid</h2>
            <p className="opsummering">Vælg en spiller og en måling. Hold musen over – eller tryk på – en kamp for at se tallet.</p>
          </div>
        </div>
        <Udvikling />
      </section>

      <section className="kort stat-kort">
        <div className="liste-top">
          <div>
            <h2>🤾 Holdets resultater</h2>
            <p className="opsummering">V = vundet · U = uafgjort · T = tabt</p>
          </div>
        </div>
        <Resultater />
      </section>

      <section className="kort stat-kort">
        <div className="liste-top">
          <div>
            <h2>🎯 Personlige mål</h2>
            <p className="opsummering">Sæt et mål – fremskridtet regnes automatisk ud fra spillerens kampe.</p>
          </div>
        </div>
        <PersonligeMaal />
      </section>
    </main>
  );
}
