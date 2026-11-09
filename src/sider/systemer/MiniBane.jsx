/*
  MINIBANE – en lille tegning af et system til kortene i oversigten:
  banen, alle i deres startposition (trin 1) som prikker, en streg for hver af vores
  spilleres løbevej gennem alle trin, og boldens vej som en stiplet gul streg.
  Har systemet varianter, tegnes de fælles trin + den FØRSTE variant.
*/
import { HJEMME, MODSTANDER_FARVE, MODSTANDER_KANT } from "../../data/konstanter.js";
import { boldPunkt } from "../../animation.js";
import { effektivtSystem } from "../../systemVarianter.js";
import { voresNoegler, erVores, erForsvarssystem, rolleInfo } from "../../systemRoller.js";

export default function MiniBane({ system: helt }) {
  // null som variant = den første variant (uden varianter får vi bare systemet selv)
  const system = effektivtSystem(helt, null);
  const forsvar = erForsvarssystem(system);
  const start = system.trin[0];

  // Løbeveje: punkterne "x,y" for spilleren i hvert trin. En "polyline" er en streg gennem flere punkter.
  // Kun VORE spillere får en løbevej: angriberne i et angrebssystem, forsvaret i et forsvarssystem.
  const loebeveje = voresNoegler(system, start).map((noegle) => {
    const punkter = system.trin.filter(t => t.pos[noegle]).map(t => `${t.pos[noegle].x},${t.pos[noegle].y}`);
    // new Set(...) fjerner dubletter: er der kun ét forskelligt punkt, har spilleren ikke flyttet sig
    if (new Set(punkter).size < 2) return null;
    // Angreb: rollens farve. Forsvar: vores gule trøjefarve.
    const farve = forsvar ? HJEMME.mark.farve : rolleInfo(noegle).farve;
    return (
      <polyline key={noegle} points={punkter.join(" ")} fill="none" stroke={farve}
                strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
    );
  });

  // Boldens vej
  const boldPunkter = system.trin.map((t) => {
    const p = boldPunkt(t.bold, t.pos);
    return `${p.x},${p.y}`;
  });

  return (
    <svg viewBox="-15 -15 230 200" aria-hidden="true">
      <rect x="0" y="0" width="200" height="200" fill="#2f6fb3" />
      <path d="M 25 0 A 60 60 0 0 0 85 60 L 115 60 A 60 60 0 0 0 175 0 Z" fill="#e98b3a" />
      <path d="M 10 0 A 90 90 0 0 0 85 90 L 115 90 A 90 90 0 0 0 190 0" fill="none"
            stroke="white" strokeWidth="1.5" strokeDasharray="5 4" />
      <rect x="0" y="0" width="200" height="200" fill="none" stroke="white" strokeWidth="1.5" />
      <rect x="85" y="-10" width="30" height="10" fill="none" stroke="white" strokeWidth="2" />

      {loebeveje}

      {new Set(boldPunkter).size > 1 && (
        <polyline points={boldPunkter.join(" ")} fill="none" stroke="#fde047"
                  strokeWidth="2" strokeDasharray="4 3" />
      )}

      {/* Alle i trin 1 som prikker: vores gule, modstanderne mørke */}
      {Object.entries(start.pos).map(([noegle, p]) => {
        const modst = !erVores(system, noegle);
        return (
          <circle key={noegle} cx={p.x} cy={p.y} r={modst ? 5 : 7}
                  fill={modst ? MODSTANDER_FARVE : HJEMME.mark.farve}
                  stroke={modst ? MODSTANDER_KANT : "white"} strokeWidth="1.5" />
        );
      })}
    </svg>
  );
}
