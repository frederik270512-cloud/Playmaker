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

createRoot(document.getElementById("root")).render(
  <DataUdbyder>
    <DialogUdbyder>
      <App />
    </DialogUdbyder>
  </DataUdbyder>
);
