/*
  STARTPUNKTET – her "monteres" React-appen i <div id="root"> i index.html.

  Rækkefølgen betyder noget: DataUdbyder og DialogUdbyder ligger UDENOM App,
  så alle sider kan bruge useData() og useDialog().
*/
import { createRoot } from "react-dom/client";
import { DataUdbyder } from "./DataKontekst.jsx";
import { DialogUdbyder } from "./komponenter/Dialog.jsx";
import App from "./App.jsx";
import "./styles.css";
import "./tema.css";            // det professionelle look – lægges ovenpå styles.css

/*
  TRÆK-VAGT: når man trykker på noget, der kan trækkes (brik, bold, tegnelag),
  får <body> klassen "traekker", indtil man slipper. Så kan INTET på siden blive
  markeret, mens man trækker – heller ikke tekst man kommer forbi (se tema.css).
  Gælder alle sider på én gang, så hver side ikke selv skal huske det.
*/
const TRAEKBART = ".brik, .sbrik, .modstander, .bold, .tegne-lag";
document.addEventListener("pointerdown", e => {
  if (e.target.closest?.(TRAEKBART)) {
    document.body.classList.add("traekker");
    window.getSelection()?.removeAllRanges();      // fjern en markering, der allerede var der
  }
}, true);   // true = "capture": vi hører det FØR brikken, som selv stopper eventet (stopPropagation)
for (const slut of ["pointerup", "pointercancel"]) {
  document.addEventListener(slut, () => document.body.classList.remove("traekker"), true);
}

createRoot(document.getElementById("root")).render(
  <DataUdbyder>
    <DialogUdbyder>
      <App />
    </DialogUdbyder>
  </DataUdbyder>
);
