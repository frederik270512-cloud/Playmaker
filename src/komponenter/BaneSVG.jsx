/*
  HÅNDBOLDBANEN – en halv bane set oppefra, tegnet som SVG.

  viewBox="-15 -30 230 252": koordinatsystemet starter i (-15,-30) og er 230 bredt og 252 højt.
  Selve banen går fra (0,0) til (200,200) – 1 enhed = 10 cm (en halv bane er 20 x 20 m).
  Modstandernes mål står øverst (y = 0), midterlinjen nederst (y = 200),
  og under midterlinjen tegner vi vores eget mål.

  useId() giver unikke id'er, så flere baner på samme side ikke "låner" hinandens mønstre.
*/
import { useId } from "react";

export default function BaneSVG() {
  const id = useId().replace(/:/g, "");   // id'er må ikke indeholde ":" i url(#...)
  const net = `net-${id}`;
  const klip = `klip-${id}`;

  return (
    <svg className="bane-svg" viewBox="-15 -30 230 252" xmlns="http://www.w3.org/2000/svg">
      <defs>
        {/* Gittermønster til nettet i målene */}
        <pattern id={net} width="3" height="3" patternUnits="userSpaceOnUse">
          <path d="M 3 0 L 0 0 0 3" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="0.4" />
        </pattern>
        {/* Klip så 9-meter-linjen ikke tegnes uden for banen */}
        <clipPath id={klip}>
          <rect x="0" y="0" width="200" height="200" />
        </clipPath>
      </defs>

      {/* Gulvet uden om banen og selve spillefladen */}
      <rect x="-15" y="-30" width="230" height="252" fill="#1d4e89" />
      <rect x="0" y="0" width="200" height="200" fill="#2f6fb3" />

      {/* Målfeltet (6 m): kvartcirkel om hver stolpe + lige linje imellem. "A" = bue. */}
      <path d="M 25 0 A 60 60 0 0 0 85 60 L 115 60 A 60 60 0 0 0 175 0 Z"
            fill="#e98b3a" stroke="white" strokeWidth="1" />

      {/* 9-meter-linjen (stiplet) */}
      <path d="M 10 0 A 90 90 0 0 0 85 90 L 115 90 A 90 90 0 0 0 190 0"
            fill="none" stroke="white" strokeWidth="1" strokeDasharray="5 4" clipPath={`url(#${klip})`} />

      {/* 7-meter- og 4-meter-mærket */}
      <line x1="95" y1="70" x2="105" y2="70" stroke="white" strokeWidth="1" />
      <line x1="99.25" y1="40" x2="100.75" y2="40" stroke="white" strokeWidth="1" />

      {/* Yderlinjer og midterlinje */}
      <rect x="0" y="0" width="200" height="200" fill="none" stroke="white" strokeWidth="1.2" />
      <line x1="0" y1="200" x2="200" y2="200" stroke="white" strokeWidth="2" />

      {/* Modstandernes mål øverst */}
      <rect x="85" y="-10" width="30" height="10" fill={`url(#${net})`} />
      <path d="M 85 0 L 85 -10 L 115 -10 L 115 0" fill="none" stroke="white" strokeWidth="1.8" />
      <path d="M 85 0 L 85 -10 L 115 -10 L 115 0" fill="none" stroke="#dc2626" strokeWidth="1.8" strokeDasharray="2 2" />

      {/* Vores eget mål nederst (spejlvendt) */}
      <rect x="85" y="200" width="30" height="10" fill={`url(#${net})`} />
      <path d="M 85 200 L 85 210 L 115 210 L 115 200" fill="none" stroke="white" strokeWidth="1.8" />
      <path d="M 85 200 L 85 210 L 115 210 L 115 200" fill="none" stroke="#dc2626" strokeWidth="1.8" strokeDasharray="2 2" />
      <text x="121" y="208" fill="rgba(255,255,255,0.6)" fontSize="6" fontWeight="600"
            fontFamily="Segoe UI, sans-serif">Eget mål</text>
    </svg>
  );
}
