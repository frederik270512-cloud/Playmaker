/*
  🎬 GEM SOM VIDEO – optager et system som en .webm-video (fx til holdets chat).

  SÅDAN VIRKER DET (helt uden ekstra biblioteker):
    1) Vi laver billeder af banen og af hver spillerfigur. De tegnes med appens EGNE
       komponenter (BaneSVG og SystemFigur): renderToStaticMarkup (fra react-dom/server,
       som allerede er en del af react-dom) laver dem om til en SVG-tekst, og et <img> læser teksten.
    2) Hvert billede i videoen tegnes på et <canvas>: banen, pilene, spillerne, bolden,
       skiltet "Trin 2 af 4" og evt. trinets 💬 tekst nederst.
    3) canvas.captureStream() laver lærredet om til en "videostrøm", og MediaRecorder
       optager strømmen, mens vi afspiller systemet i ÆGTE tid (med den valgte hastighed).
    4) Til sidst samler vi stykkerne til en Blob (en fil i hukommelsen) og henter den ned.

  Alt foregår på et usynligt lærred – systemet på skærmen bliver ikke rørt.
*/
import { createElement } from "react";
import BaneSVG from "../../komponenter/BaneSVG.jsx";
import { SystemFigur } from "../../komponenter/Figur.jsx";
import { trinPileListe, pilGeometri } from "../../komponenter/Pile.jsx";
import { tilstandVed, boldPosition, erSkud } from "../../animation.js";
import { erVores, erForsvarssystem } from "../../systemRoller.js";
import { baneViewBox } from "../../hjaelpere.js";

const FPS = 30;                // billeder pr. sekund i videoen
const PAUSE_START = 1.2;       // sekunder på trin 1, før det går i gang
const PAUSE_SLUT = 2;          // sekunder på sidste trin, før videoen slutter
const FIGUR_BREDDE = 19;       // spillerfigurens bredde i banens enheder (19 = 1,9 m – som på skærmen)

/*
  Kan browseren optage video? Vi foretrækker webm med vp9, så vp8, så almindelig webm.
  (Safari kan kun mp4 – så laver vi en .mp4 i stedet.) Giver null, hvis det slet ikke kan lade sig gøre.
*/
export function videoFormat() {
  if (typeof MediaRecorder === "undefined" || typeof HTMLCanvasElement === "undefined" ||
      !HTMLCanvasElement.prototype.captureStream) return null;
  const muligheder = [
    { mimeType: "video/webm;codecs=vp9", endelse: "webm" },
    { mimeType: "video/webm;codecs=vp8", endelse: "webm" },
    { mimeType: "video/webm", endelse: "webm" },
    { mimeType: "video/mp4", endelse: "mp4" },
  ];
  return muligheder.find(m => MediaRecorder.isTypeSupported?.(m.mimeType)) ?? null;
}

// Et filnavn ud fra systemets navn: tegn, som Windows ikke tillader i filnavne, fjernes
export function videoFilnavn(navn, endelse = "webm") {
  const rent = String(navn || "system").replace(/[\\/:*?"<>|]+/g, "").trim() || "system";
  return `${rent}.${endelse}`;
}

// Hent en Blob ned som en fil (et usynligt <a download> som vi "klikker" på)
export function hentFil(blob, filnavn) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filnavn;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);   // ryd op, når hentningen er i gang
}

/*
  Lav en SVG-tekst om til et billede (<img>), som kan tegnes på lærredet.
  Et SVG-billede skal have xmlns, bredde og højde – dem sætter vi ind i det første <svg>-tag.
*/
async function svgTilBillede(markup, bredde, hoejde) {
  let svg = markup.replace("<svg", `<svg width="${bredde}" height="${hoejde}"`);
  if (!svg.includes("xmlns=")) svg = svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  const billede = new Image();
  billede.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  await billede.decode();                // vent til billedet er klar
  return billede;
}

// En afrundet firkant (til skiltet og navnene)
function afrundetFirkant(ctx, x, y, b, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + b, y, x + b, y + h, r);
  ctx.arcTo(x + b, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + b, y, r);
  ctx.closePath();
}

// Del en tekst op i linjer, der hver højst er "maks" pixels brede
function delILinjer(ctx, tekst, maks) {
  const linjer = [];
  let linje = "";
  for (const ord of tekst.split(/\s+/)) {
    const proeve = linje ? linje + " " + ord : ord;
    if (ctx.measureText(proeve).width > maks && linje) {
      linjer.push(linje);
      linje = ord;
    } else {
      linje = proeve;
    }
  }
  if (linje) linjer.push(linje);
  return linjer;
}

// Tegn én pil (samme udseende som <Pil> i Pile.jsx) – ctx står i banens koordinater
function tegnPil(ctx, p) {
  const g = pilGeometri(p.a, p.b, p.slutAfstand);
  if (!g) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.setLineDash(p.stiplet ? [3, 2.5] : []);
  // Først en mørk "skygge"-streg, så den farvede ovenpå
  ctx.globalAlpha *= 0.6;
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 3.2;
  ctx.beginPath(); ctx.moveTo(g.x1, g.y1); ctx.lineTo(g.x2, g.y2); ctx.stroke();
  ctx.globalAlpha /= 0.6;
  ctx.strokeStyle = p.farve;
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(g.x1, g.y1); ctx.lineTo(g.x2, g.y2); ctx.stroke();
  // Pilespidsen
  ctx.setLineDash([]);
  ctx.beginPath();
  g.spids.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
  ctx.fillStyle = p.farve;
  ctx.fill();
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 0.6;
  ctx.stroke();
  ctx.restore();
}

/*
  Forbered alt det, der ikke ændrer sig undervejs: lærredets størrelse, banen og figurerne.
  Giver en funktion tegn(tid) tilbage, der tegner ét billede af videoen.
*/
async function forbered({ system, visTekst, trinNavn, spillerNavn }) {
  const { renderToStaticMarkup } = await import("react-dom/server");   // hentes først, når den skal bruges
  const helBane = system.helBane === true;
  const forsvar = erForsvarssystem(system);
  const vb = baneViewBox(helBane);

  // Pixels pr. enhed: halv bane 920 x 1008 px, hel bane 690 x 1380 px (lige tal – det kræver video)
  const S = helBane ? 3 : 4;
  const bredde = vb.bredde * S;
  const baneHoejde = vb.hoejde * S;
  const tekstHoejde = visTekst ? 40 * S : 0;     // plads til 💬-teksten under banen
  const hoejde = baneHoejde + tekstHoejde;

  // Banen (appens egen BaneSVG) som ét billede
  const bane = await svgTilBillede(
    renderToStaticMarkup(createElement(BaneSVG, { helBane, forsvar })), bredde, baneHoejde);

  // Hver brik som et billede (appens egen SystemFigur). 60 x 64 er figurens egen viewBox.
  const noegler = Object.keys(system.trin[0].pos);
  const figurer = {};
  for (const noegle of noegler) {
    figurer[noegle] = await svgTilBillede(
      renderToStaticMarkup(createElement(SystemFigur, { noegle, forsvar })), 60 * 4, 64 * 4);
  }
  // Modstanderne tegnes først (så vores spillere ligger ovenpå – som z-index på skærmen)
  const raekkefoelge = [...noegler].sort((a, b) => Number(erVores(system, a)) - Number(erVores(system, b)));

  function tegn(ctx, tid) {
    const t = tilstandVed(system, tid);
    const trinIndex = Number.isInteger(tid) ? tid : null;

    // 1) Baggrund og bane (i pixels)
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, bredde, hoejde);
    ctx.drawImage(bane, 0, 0, bredde, baneHoejde);

    // Fra nu af tegner vi i BANENS koordinater (som på skærmen): skalér og flyt
    ctx.setTransform(S, 0, 0, S, -vb.x * S, -vb.y * S);

    // 2) Pilene – samme regler som SystemBane: på et trin tydelige, mellem to trin svage
    const pile = trinIndex !== null
      ? trinPileListe(trinIndex > 0 ? system.trin[trinIndex - 1] : null, system.trin[trinIndex], forsvar)
      : trinPileListe(system.trin[t.fraIndex], system.trin[t.fraIndex + 1], forsvar);
    ctx.globalAlpha = trinIndex !== null ? 1 : 0.45;
    pile.forEach(p => tegnPil(ctx, p));
    ctx.globalAlpha = 1;

    // 3) Spillerne (med en lille skygge under – som drop-shadow på skærmen)
    for (const noegle of raekkefoelge) {
      const p = t.pos[noegle];
      if (!p) continue;
      const modst = !erVores(system, noegle);
      const b = FIGUR_BREDDE * (modst ? 0.85 : 1);
      const h = b * 64 / 60;
      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
      ctx.shadowBlur = 3 * S;
      ctx.shadowOffsetY = 1.2 * S;
      ctx.drawImage(figurer[noegle], p.x - b / 2, p.y - h / 2, b, h);
      ctx.restore();

      // Navnet fra taktiktavlen under vores angribere (ikke i forsvarssystemer)
      const navn = !forsvar && !modst ? spillerNavn(noegle) : "";
      if (navn) {
        ctx.font = "600 4px 'Segoe UI', sans-serif";
        const nb = ctx.measureText(navn).width + 4;
        afrundetFirkant(ctx, p.x - nb / 2, p.y + h / 2 + 0.4, nb, 5.6, 2.5);
        ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
        ctx.fill();
        ctx.fillStyle = "#e2e8f0";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(navn, p.x, p.y + h / 2 + 3.3);
      }
    }

    // 4) Bolden: en lille gul/hvid kugle
    const bp = boldPosition(t);
    const r = 2.9;
    const glans = ctx.createRadialGradient(bp.x - r * 0.3, bp.y - r * 0.3, 0, bp.x, bp.y, r);
    glans.addColorStop(0, "#ffffff");
    glans.addColorStop(0.6, "#fde047");
    glans.addColorStop(1, "#ca8a04");
    ctx.beginPath();
    ctx.arc(bp.x, bp.y, r, 0, Math.PI * 2);
    ctx.fillStyle = glans;
    ctx.fill();
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 0.55;
    ctx.stroke();

    // 5) Skiltet øverst til venstre: "Navn · Trin 2 af 4"
    const skilt = `${system.navn} · ` + (trinIndex !== null
      ? `Trin ${trinNavn(trinIndex)} af ${system.trin.length}` + (erSkud(system.trin[trinIndex].bold) ? " · 🥅 Skud på mål!" : "")
      : `Trin ${trinNavn(t.fraIndex)} → ${trinNavn(t.fraIndex + 1)}`);
    ctx.font = "700 5px 'Segoe UI', sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const sb = Math.min(ctx.measureText(skilt).width + 7, vb.bredde - 7);
    afrundetFirkant(ctx, vb.x + 3.5, vb.y + 3.5, sb, 9, 2.8);
    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.fill();
    ctx.fillStyle = "#f1f5f9";
    ctx.fillText(skilt, vb.x + 7, vb.y + 8, sb - 7);

    // 6) 💬 Teksten under banen (som tekstbjælken i appen) – tilbage i pixels
    if (visTekst) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      // Mellem to trin: teksten for det trin, spillerne er på vej hen til (som i SystemEditor)
      const tekstIndex = trinIndex !== null ? trinIndex : Math.min(Math.floor(tid) + 1, system.trin.length - 1);
      const tekst = system.trin[tekstIndex]?.tekst || "";
      const top = baneHoejde;
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(0, top, bredde, tekstHoejde);
      ctx.fillStyle = tekst ? "#fde047" : "#475569";
      ctx.fillRect(0, top, 4 * S / 2, tekstHoejde);
      const fontStr = 5.2 * S;
      ctx.font = `600 ${fontStr}px 'Segoe UI', sans-serif`;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillStyle = tekst ? "#f1f5f9" : "#94a3b8";
      const linjer = delILinjer(ctx, `💬 Trin ${trinNavn(tekstIndex)}: ${tekst || "Ingen tekst til dette trin."}`,
        bredde - 12 * S);
      linjer.slice(0, 4).forEach((linje, i) => ctx.fillText(linje, 6 * S, top + 5 * S + i * fontStr * 1.35));
    }
  }

  return { bredde, hoejde, tegn };
}

/*
  Optag systemet fra trin 1 til sidste trin i ægte tid.
    system       – det EFFEKTIVE system (fælles trin + valgt variant)
    sekPrTrin    – den valgte hastighed (sekunder pr. trin)
    visTekst     – skal 💬-teksten med?
    trinNavn(i)  – navnet på trin i, fx "4A"
    spillerNavn(noegle) – navn fra taktiktavlen (eller "")
    onFremskridt(andel) – kaldes løbende med 0-1 (til "Optager… 40 %")
    signal       – en AbortSignal: når den afbrydes, stopper optagelsen (Annuller)
  Giver { blob, endelse } – eller null, hvis optagelsen blev annulleret.
*/
export async function optagVideo({ system, sekPrTrin, visTekst, trinNavn, spillerNavn, onFremskridt, signal }) {
  const format = videoFormat();
  if (!format) throw new Error("Browseren kan ikke optage video.");

  const { bredde, hoejde, tegn } = await forbered({ system, visTekst, trinNavn, spillerNavn });
  if (signal?.aborted) return null;

  // Lærredet lægges uden for skærmen (nogle browsere optager kun et lærred, der er på siden)
  const laerred = document.createElement("canvas");
  laerred.width = bredde;
  laerred.height = hoejde;
  laerred.style.cssText = "position:fixed;left:-99999px;top:0;pointer-events:none;";
  document.body.appendChild(laerred);
  const ctx = laerred.getContext("2d");

  // Hvor i systemet er vi, "sek" sekunder inde i videoen? (pause → afspilning → pause)
  const sidste = system.trin.length - 1;
  const varighed = PAUSE_START + sidste * sekPrTrin + PAUSE_SLUT;
  function tidVed(sek) {
    if (sek <= PAUSE_START) return 0;
    return Math.min(sidste, (sek - PAUSE_START) / sekPrTrin);
  }

  tegn(ctx, 0);                                   // første billede, før optagelsen starter
  const stroem = laerred.captureStream(FPS);
  const optager = new MediaRecorder(stroem, { mimeType: format.mimeType, videoBitsPerSecond: 6_000_000 });
  const stykker = [];
  optager.ondataavailable = (e) => { if (e.data && e.data.size > 0) stykker.push(e.data); };

  return new Promise((resolve, reject) => {
    let anmodning = 0;
    let annulleret = false;

    function ryd() {
      cancelAnimationFrame(anmodning);
      stroem.getTracks().forEach(spor => spor.stop());
      laerred.remove();
      signal?.removeEventListener("abort", annuller);
    }
    function annuller() {
      annulleret = true;
      if (optager.state !== "inactive") optager.stop();
    }

    optager.onstop = () => {
      ryd();
      resolve(annulleret ? null : { blob: new Blob(stykker, { type: format.mimeType }), endelse: format.endelse });
    };
    optager.onerror = (e) => {
      ryd();
      reject(e.error ?? new Error("Optagelsen gik galt."));
    };
    signal?.addEventListener("abort", annuller);

    optager.start(250);                           // giv os data i stykker af 250 ms
    const start = performance.now();
    let sidstTegnet = -1;

    // requestAnimationFrame: tegn et nyt billede, når skærmen er klar (vi tegner højst FPS gange i sekundet)
    function loekke(nu) {
      if (annulleret || optager.state === "inactive") return;
      const sek = (nu - start) / 1000;
      const billedeNr = Math.floor(sek * FPS);
      if (billedeNr !== sidstTegnet) {
        sidstTegnet = billedeNr;
        tegn(ctx, tidVed(sek));
        onFremskridt?.(Math.min(1, sek / varighed));
      }
      if (sek >= varighed) {
        optager.stop();
        return;
      }
      anmodning = requestAnimationFrame(loekke);
    }
    anmodning = requestAnimationFrame(loekke);
  });
}
