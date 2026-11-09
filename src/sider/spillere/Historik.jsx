/*
  HISTORIK – fanen "📊 Historik" for en spiller:
    tal-felter (kampe, mål ...), "Bedst imod", listen over kampe,
    formularen til at tilføje en kamp og evalueringen (god til / ikke så god til / øve sig på).

  Props:
    spiller – den spiller hvis historik vises
*/
import { useState } from "react";
import { useData } from "../../DataKontekst.jsx";
import { useDialog } from "../../komponenter/Dialog.jsx";
import { idagISO, formatDato, decimal, sumAf, nytId } from "../../hjaelpere.js";

// Et af tal-felterne øverst. klasse = "god" (grøn) eller "daarlig" (rød)
function StatFelt({ navn, tal, underTekst, klasse = "" }) {
  return (
    <div className={"stat " + klasse}>
      <div className="stat-tal">{tal}</div>
      <div className="stat-navn">{navn}</div>
      <div className="stat-snit">{underTekst}</div>
    </div>
  );
}

/*
  "Bedst imod": vi samler kampene pr. modstander og giver hvert hold en score:
    (mål + assists − tekniske fejl) / antal kampe
  De 3 hold med højest score vises.
*/
function BedstImod({ kampe }) {
  const perHold = {};   // fx { "Vestby HK": { kampe: 2, maal: 9, ... } }
  for (const kamp of kampe) {
    if (!perHold[kamp.modstander]) {
      perHold[kamp.modstander] = { navn: kamp.modstander, kampe: 0, maal: 0, assists: 0, afbraendere: 0, tekniskeFejl: 0 };
    }
    const hold = perHold[kamp.modstander];
    hold.kampe++;
    hold.maal += kamp.maal;
    hold.assists += kamp.assists;
    hold.afbraendere += kamp.afbraendere;
    hold.tekniskeFejl += kamp.tekniskeFejl;
  }

  const score = h => (h.maal + h.assists - h.tekniskeFejl) / h.kampe;
  const top3 = Object.values(perHold).sort((a, b) => score(b) - score(a)).slice(0, 3);

  if (top3.length === 0) return <p className="tom-tekst">Tilføj kampe for at se det.</p>;

  const medaljer = ["🥇", "🥈", "🥉"];
  return (
    <div>
      {top3.map((h, i) => {
        const skud = h.maal + h.afbraendere;
        return (
          <div key={h.navn} className="bedst-linje">
            <span className="medalje">{medaljer[i]}</span>
            <div>
              <b>{h.navn}</b>
              <small>
                {h.kampe} {h.kampe === 1 ? "kamp" : "kampe"} · {decimal((h.maal + h.assists) / h.kampe)} mål+assists pr. kamp
                {skud ? ` · ${Math.round((h.maal / skud) * 100)}% skud` : ""}
              </small>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Tom kamp-formular (tallene er tekst, fordi <input> altid giver tekst)
function tomKamp() {
  return { dato: idagISO(), modstander: "", maal: "0", assists: "0", afbraendere: "0", tekniskeFejl: "0" };
}

export default function Historik({ spiller }) {
  const { data, opdater } = useData();
  const { bekraeftSlet } = useDialog();

  // Hele kamp-formularen i ÉT objekt. Når et felt ændres, laver vi et nyt objekt med {...gammel, felt: ny}
  const [nyKamp, setNyKamp] = useState(tomKamp);

  // Evalueringen: vi skriver i en lokal kopi og gemmer først, når man forlader feltet
  const [evaluering, setEvaluering] = useState({
    styrker: spiller.styrker, svagheder: spiller.svagheder, oevelse: spiller.oevelse,
  });
  const [evalBesked, setEvalBesked] = useState("");

  // Lille hjælper: ret i DENNE spiller inde i opdater()
  function aendrSpiller(aendring) {
    opdater(d => {
      const s = d.spillere.find(x => x.id === spiller.id);
      if (s) aendring(s);
    });
  }

  /* ---------- Tal-felterne ---------- */
  const kampe = spiller.kampe;
  const antal = kampe.length;
  const maal = sumAf(kampe, "maal");
  const assists = sumAf(kampe, "assists");
  const afbraendere = sumAf(kampe, "afbraendere");
  const fejl = sumAf(kampe, "tekniskeFejl");
  const skud = maal + afbraendere;                    // alle afslutninger
  const prKamp = tal => antal ? decimal(tal / antal) + " pr. kamp" : "";

  // Forslag til modstander-feltet: alle holdnavne der er skrevet før (Set fjerner dubletter)
  const holdnavne = [...new Set(data.spillere.flatMap(s => s.kampe.map(k => k.modstander)))];

  // Nyeste kamp først
  const sorteredeKampe = [...kampe].sort((a, b) => b.dato.localeCompare(a.dato));

  async function sletKamp(kamp) {
    if (!(await bekraeftSlet("Slet kamp?",
        `Kampen mod ${kamp.modstander} (${formatDato(kamp.dato)}) bliver slettet fra ${spiller.navn}s historik.`))) return;
    aendrSpiller(s => { s.kampe = s.kampe.filter(k => k.id !== kamp.id); });
  }

  // Kører når man trykker "+ Tilføj kamp"
  function tilfoejKamp(e) {
    e.preventDefault();
    const tal = tekst => Math.max(0, Number(tekst) || 0);   // tomt felt = 0
    const kamp = {
      id: nytId(),
      dato: nyKamp.dato,
      modstander: nyKamp.modstander.trim(),
      maal: tal(nyKamp.maal),
      assists: tal(nyKamp.assists),
      afbraendere: tal(nyKamp.afbraendere),
      tekniskeFejl: tal(nyKamp.tekniskeFejl),
    };
    aendrSpiller(s => { s.kampe.push(kamp); });
    setNyKamp(tomKamp());          // tal-felterne går tilbage til 0
  }

  // Ændr ét felt i kamp-formularen
  function saetKampFelt(felt, vaerdi) {
    setNyKamp(gammel => ({ ...gammel, [felt]: vaerdi }));
  }

  // Evalueringen gemmes, når man forlader et tekstfelt (som "change" i den gamle udgave)
  function gemEvaluering() {
    const ny = {
      styrker: evaluering.styrker.trim(),
      svagheder: evaluering.svagheder.trim(),
      oevelse: evaluering.oevelse.trim(),
    };
    // Intet ændret? Så gemmer vi ikke (og viser ingen besked)
    if (ny.styrker === spiller.styrker && ny.svagheder === spiller.svagheder && ny.oevelse === spiller.oevelse) return;
    aendrSpiller(s => Object.assign(s, ny));
    setEvalBesked("Evaluering gemt ✓");
  }

  // De tre tekstfelter i evalueringen er ens – derfor laver vi dem ud fra en liste
  const EVAL_FELTER = [
    { felt: "styrker",   tekst: "👍 God til",          pladsholder: "f.eks. Overblik, gennembrud til venstre" },
    { felt: "svagheder", tekst: "👎 Ikke så god til",  pladsholder: "f.eks. Skud under pres" },
    { felt: "oevelse",   tekst: "🎯 Skal øve sig på",  pladsholder: "f.eks. Hoppeskud fra 9 meter" },
  ];

  const KAMP_TAL = [
    { felt: "maal",         tekst: "Mål" },
    { felt: "assists",      tekst: "Assists" },
    { felt: "afbraendere",  tekst: "Afbrændere" },
    { felt: "tekniskeFejl", tekst: "Tekn. fejl" },
  ];

  return (
    <div>
      <div className="stat-gitter">
        <StatFelt navn="Kampe" tal={antal} underTekst="" />
        <StatFelt navn="Mål" tal={maal} underTekst={prKamp(maal)} klasse="god" />
        <StatFelt navn="Assists" tal={assists} underTekst={prKamp(assists)} klasse="god" />
        <StatFelt navn="Afbrændere" tal={afbraendere} underTekst={prKamp(afbraendere)} klasse="daarlig" />
        <StatFelt navn="Tekn. fejl" tal={fejl} underTekst={prKamp(fejl)} klasse="daarlig" />
        <StatFelt
          navn="Skud %"
          tal={skud ? Math.round((maal / skud) * 100) + "%" : "–"}
          underTekst={skud ? `${maal} af ${skud} skud` : ""}
        />
      </div>

      <h3>🏆 Bedst imod</h3>
      <BedstImod kampe={kampe} />

      <h3>Kampe</h3>
      {sorteredeKampe.length === 0 ? (
        <p className="tom-tekst">Ingen kampe endnu.</p>
      ) : (
        <table className="kamp-tabel">
          <thead>
            <tr>
              <th>Dato</th><th>Modstander</th><th className="tal">M</th><th className="tal">A</th>
              <th className="tal">Afb</th><th className="tal">TF</th><th></th>
            </tr>
          </thead>
          <tbody>
            {sorteredeKampe.map(k => (
              <tr key={k.id}>
                <td>{formatDato(k.dato)}</td>
                <td>{k.modstander}</td>
                <td className="tal"><b>{k.maal}</b></td>
                <td className="tal">{k.assists}</td>
                <td className="tal">{k.afbraendere}</td>
                <td className="tal">{k.tekniskeFejl}</td>
                <td><button type="button" className="slet-x" title="Slet kamp" onClick={() => sletKamp(k)}>×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <form className="skade-form" onSubmit={tilfoejKamp}>
        <div className="felt-raekke">
          <label className="felt">Dato
            <input type="date" required value={nyKamp.dato} onChange={e => saetKampFelt("dato", e.target.value)} />
          </label>
          <label className="felt">Modstander
            {/* list="..." giver forslag fra holdnavne man har skrevet før */}
            <input type="text" list="modstander-forslag" maxLength={40} required
                   value={nyKamp.modstander} onChange={e => saetKampFelt("modstander", e.target.value)} />
            <datalist id="modstander-forslag">
              {holdnavne.map(navn => <option key={navn} value={navn} />)}
            </datalist>
          </label>
        </div>
        <div className="felt-raekke tal-felter">
          {KAMP_TAL.map(({ felt, tekst }) => (
            <label key={felt} className="felt">{tekst}
              <input type="number" min="0" max="40"
                     value={nyKamp[felt]} onChange={e => saetKampFelt(felt, e.target.value)} />
            </label>
          ))}
        </div>
        <button type="submit" className="knap">+ Tilføj kamp</button>
      </form>

      <h3>Evaluering</h3>
      <form className="skade-form" style={{ borderStyle: "solid" }} onSubmit={e => e.preventDefault()}>
        {EVAL_FELTER.map(({ felt, tekst, pladsholder }) => (
          <label key={felt} className="felt">{tekst}
            <textarea
              rows={2}
              maxLength={300}
              placeholder={pladsholder}
              value={evaluering[felt]}
              onChange={e => setEvaluering(gammel => ({ ...gammel, [felt]: e.target.value }))}
              onBlur={gemEvaluering}
            />
          </label>
        ))}
        <p className="besked ok">{evalBesked}</p>
      </form>
    </div>
  );
}
