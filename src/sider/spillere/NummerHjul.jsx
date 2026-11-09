/*
  NUMMERHJULET – vælg trøjenummer ved at "dreje" på en liste med tallene 1-99.

  Hjulet er en liste, der kan scrolles. CSS'en "scroll-snap" (i styles.css) får den
  til at stoppe præcis på et tal. Det tal der står i midten, er det valgte. Vi drejer
  tallene lidt (rotateX), så det ligner et rigtigt hjul. Numre der er taget af ANDRE
  spillere, er grå/overstregede og kan ikke vælges – hjulet hopper videre til det
  nærmeste ledige nummer. Under hjulet kan man også skrive nummeret selv.

  Props (det komponenten får udefra):
    vaerdi    – teksten i nummerfeltet, fx "9" (bor i forælderen, så "Gem spiller" kan læse den)
    onVaerdi  – funktion der ændrer vaerdi
    andre     – de ANDRE spillere (deres numre er optaget – ens eget må man gerne beholde)
    onBesked  – funktion der viser en besked under formularen, fx onBesked("Fejl!", "fejl")

  VIGTIGT: Komponenten bliver først "monteret" (sat ind på siden), når fanen Oplysninger
  vises. Et skjult element kan ikke scrolles, så derfor stiller vi hjulet, når den monteres.
*/
import { useEffect, useLayoutEffect, useRef, useState } from "react";

const HJUL_TAL_HOEJDE = 36;     // skal passe med .hjul-tal { height: 36px } i styles.css
const TAL = Array.from({ length: 99 }, (_, i) => i + 1);   // [1, 2, 3, ..., 99]

export default function NummerHjul({ vaerdi, onVaerdi, andre, onBesked }) {
  // useRef giver en "kasse" der overlever mellem tegninger, uden at ændre den tegner siden forfra.
  // hjulRef.current bliver selve <div>-elementet (via ref={hjulRef} længere nede).
  const hjulRef = useRef(null);
  const feltRef = useRef(null);
  const timerRef = useRef(null);      // id'et fra setTimeout, så vi kan nulstille "stop-uret"

  // Hvor langt hjulet er drejet, målt i tal: fx 8.4 = lidt under tallet 9.
  // Det bruges til "3D"-effekten og til at markere tallet i midten.
  const [midte, setMidte] = useState(0);

  const optagne = andre.map(s => s.nummer);

  // Drej hjulet så "n" står i midten. glat = true giver en blød bevægelse.
  function scrollTilNummer(n, glat) {
    const hjul = hjulRef.current;
    if (!hjul) return;
    const top = (n - 1) * HJUL_TAL_HOEJDE;
    hjul.scrollTo({ top, behavior: glat ? "smooth" : "instant" });
    // En blød bevægelse sender selv "scroll"-hændelser. Et øjeblikkeligt hop gør ikke
    // altid (fx hvis vi allerede står der), så her sætter vi midten selv.
    if (!glat) setMidte(hjul.scrollTop / HJUL_TAL_HOEJDE);
  }

  /*
    useLayoutEffect med en tom liste [] kører ÉN gang, lige efter komponenten er sat ind
    på siden – men FØR browseren tegner den. Så ser man aldrig hjulet stå på 1 et kort øjeblik.
    Vi vil kun stille hjulet ved start (ikke hver gang vaerdi ændrer sig, for det klarer
    hjulet/feltet selv), derfor er listen tom.
  */
  useLayoutEffect(() => {
    scrollTilNummer(Number(vaerdi) || 1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Oprydning: når komponenten fjernes, stopper vi et "stop-ur" der måske stadig tikker
  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  // Kører hele tiden, mens man drejer på hjulet
  function drejHjul() {
    setMidte(hjulRef.current.scrollTop / HJUL_TAL_HOEJDE);   // opdater "3D"-effekten med det samme
    clearTimeout(timerRef.current);                           // nulstil "stop-uret"...
    timerRef.current = setTimeout(hjulStoppet, 120);          // ...og kør hjulStoppet, når man har holdt op
  }

  // Kører når hjulet står stille: læs tallet i midten (og spring over optagne numre)
  function hjulStoppet() {
    const hjul = hjulRef.current;
    if (!hjul) return;
    let n = Math.round(hjul.scrollTop / HJUL_TAL_HOEJDE) + 1;
    if (optagne.includes(n)) {
      // Find det nærmeste ledige nummer: prøv n+1, n-1, n+2, n-2 ...
      for (let d = 1; d < 99; d++) {
        if (n + d <= 99 && !optagne.includes(n + d)) { n = n + d; break; }
        if (n - d >= 1 && !optagne.includes(n - d)) { n = n - d; break; }
      }
      scrollTilNummer(n, true);
    }
    // Skriver man selv i feltet, må hjulet ikke overskrive det, man er ved at skrive
    if (document.activeElement !== feltRef.current) onVaerdi(String(n));
  }

  // Kører når man skriver i nummerfeltet
  function nummerSkrevet(e) {
    const tekst = e.target.value.replace(/\D/g, "");   // fjern alt der ikke er cifre (\D = "ikke ciffer")
    onVaerdi(tekst);
    const n = Number(tekst);
    const optagetAf = andre.find(s => s.nummer === n);

    if (optagetAf) {
      onBesked(`Nummer ${n} er taget af ${optagetAf.navn}.`, "fejl");
    } else if (n >= 1 && n <= 99) {
      onBesked("");
      scrollTilNummer(n, true);
    }
  }

  // Feltet bliver rødt, hvis der står et nummer, som en anden spiller har
  const forkert = optagne.includes(Number(vaerdi));
  const valgtIndex = Math.round(midte);

  return (
    <div className="felt felt-hjul">Nummer
      <div className="hjul-ramme">
        <div className="nummer-hjul" ref={hjulRef} onScroll={drejHjul}>
          {TAL.map((n, index) => {
            const afstand = index - midte;               // negativ = over midten, positiv = under
            const optaget = optagne.includes(n);
            // Tallene tæt på midten hælder lidt og bliver mindre, jo længere væk de er
            const transform = Math.abs(afstand) > 3 ? undefined :
              `perspective(300px) rotateX(${-afstand * 22}deg) scale(${1 - Math.abs(afstand) * 0.1})`;
            return (
              // key: React skal kunne kende hvert element i en liste fra hinanden
              <div
                key={n}
                className={"hjul-tal" + (index === valgtIndex ? " valgt" : "") + (optaget ? " optaget" : "")}
                style={{ transform }}
                onClick={() => { if (!optaget) scrollTilNummer(n, true); }}
              >
                {n}
              </div>
            );
          })}
        </div>
      </div>
      {/* Man kan også skrive nummeret selv. id="felt-nummer" bruges af CSS'en. */}
      <input
        ref={feltRef}
        type="text"
        id="felt-nummer"
        className={forkert ? "forkert" : ""}
        inputMode="numeric"
        maxLength={2}
        placeholder="Skriv"
        title="Skriv et nummer"
        required
        value={vaerdi}
        onChange={nummerSkrevet}
      />
    </div>
  );
}
