/*
  SPILLERFIGURER – overkrop (hoved + trøje) tegnet som SVG.

    <Figur farve="#facc15" tekstfarve="#1e1e1e" tekst={9} />
    <HjemmeFigur rolle="C" tekst={9} />      // vores trøjer: gul – målmand grå med lange ærmer
    <ModstanderFigur nr={3} />               // modstander: mørk – målmand (nr 0) mørkerød
    <SystemFigur noegle="M3" forsvar />      // en brik i et system (vælger selv trøjen, se nederst)
*/
import { HJEMME, MODSTANDER_FARVE, MODSTANDER_KANT, MODSTANDER_MV_FARVE } from "../data/konstanter.js";

// Trøjens omrids: kortærmet (markspiller) og langærmet (målmand)
const KORTAERMET = "M 21 22 L 9 27 L 2 41 L 11 45 L 16 36 L 16 62 L 44 62 L 44 36 " +
                   "L 49 45 L 58 41 L 51 27 L 39 22 Q 30 30 21 22 Z";
const LANGAERMET = "M 21 22 L 9 27 L 3 44 L 1 60 L 9 61 L 12 46 L 16 36 L 16 62 L 44 62 L 44 36 " +
                   "L 48 46 L 51 61 L 59 60 L 57 44 L 51 27 L 39 22 Q 30 30 21 22 Z";

export function Figur({ farve, tekstfarve, tekst, kant = "white", langaermet = false }) {
  return (
    <svg viewBox="0 0 60 64" aria-hidden="true">
      <path d={langaermet ? LANGAERMET : KORTAERMET}
            fill={farve} stroke={kant} strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="30" cy="11" r="9" fill="#e0b48c" stroke={kant} strokeWidth="2.5" />
      <text x="30" y="53" textAnchor="middle" fontSize="17" fontWeight="800"
            fill={tekstfarve} fontFamily="Segoe UI, sans-serif">{tekst}</text>
    </svg>
  );
}

// Vores spiller. rolle = den plads han står på (bestemmer trøjen)
export function HjemmeFigur({ rolle, tekst }) {
  const t = rolle === "MV" ? HJEMME.maalmand : HJEMME.mark;
  return <Figur farve={t.farve} tekstfarve={t.tekst} tekst={tekst} langaermet={t.langaermet} />;
}

// Modstander. nr 0 = målmand, 1-6 = markspillere. "tekst" kan overskrive nummeret.
export function ModstanderFigur({ nr, tekst, maalmand }) {
  const erMaalmand = maalmand ?? nr === 0;
  return erMaalmand
    ? <Figur farve={MODSTANDER_MV_FARVE} tekstfarve="white" tekst={tekst ?? "MV"} kant={MODSTANDER_KANT} langaermet />
    : <Figur farve={MODSTANDER_FARVE} tekstfarve="white" tekst={tekst ?? nr} kant={MODSTANDER_KANT} />;
}

/*
  En brik i et SYSTEM. Den finder selv ud af, hvilken trøje der skal på:
    angrebssystem:  VF, VB ... = os (gul, rollekoden)    M0-M6 = modstander (mørk, nummer)
    forsvarssystem: M1-M6 = os (gul, nummer), M0 = vores målmand (grå, "MV")
                    VF, VB ... = modstanderens angribere (mørk, rollekoden)
  tekst (valgfri) overskriver teksten på VORE angriberes trøjer (fx trøjenummeret på tavlen).

  "VM" = målmanden for holdet MED bolden – bruges kun i systemer på hel bane (kontra), hvor
  angrebet starter ved målmanden. Nøglen starter IKKE med "M", så han hører til angriberne.
    angrebssystem:  vores målmand (grå, lange ærmer, "MV")
    forsvarssystem: modstanderens målmand (mørkerød, "MV")
*/
export function SystemFigur({ noegle, forsvar = false, tekst }) {
  if (noegle === "VM") {
    return forsvar
      ? <ModstanderFigur maalmand tekst="MV" />
      : <HjemmeFigur rolle="MV" tekst={tekst ?? "MV"} />;
  }
  const erM = noegle.startsWith("M");
  const nr = Number(noegle.slice(1));        // "M3" → 3
  if (!forsvar) {
    return erM ? <ModstanderFigur nr={nr} /> : <HjemmeFigur rolle={noegle} tekst={tekst ?? noegle} />;
  }
  if (erM) {
    return nr === 0 ? <HjemmeFigur rolle="MV" tekst="MV" /> : <HjemmeFigur rolle={noegle} tekst={nr} />;
  }
  return <ModstanderFigur maalmand={false} tekst={noegle} />;
}
