/*
  "ER DU SIKKER?"-BOKSEN

  Brug i en komponent:
      const { spoerg, bekraeftSlet } = useDialog();

      if (!(await bekraeftSlet("Slet Malthe?", "Det kan ikke fortrydes."))) return;

      const svar = await spoerg("Titel", "Tekst", [
        { tekst: "Annuller", svar: false },
        { tekst: "OK", svar: true, stil: "knap-primaer" },
      ]);

  spoerg() venter på, at man trykker på en knap, og giver knappens "svar" tilbage
  (null hvis man trykker Escape). Derfor skal den bruges med "await".
*/
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

const DialogKontekst = createContext(null);

export function DialogUdbyder({ children }) {
  // Den boks der vises lige nu: { titel, tekst, knapper, svar: funktion } – eller null
  const [boks, setBoks] = useState(null);
  const dialogRef = useRef(null);

  const spoerg = useCallback((titel, tekst, knapper) => {
    // Et "Promise" er et løfte om et svar senere. resolve() indfrier løftet.
    return new Promise((resolve) => setBoks({ titel, tekst, knapper, svar: resolve }));
  }, []);

  const bekraeftSlet = useCallback(async (titel, tekst) => {
    const svar = await spoerg(titel, tekst, [
      { tekst: "Annuller", svar: false },
      { tekst: "🗑 Ja, slet", svar: true, stil: "knap-fare" },
    ]);
    return svar === true;
  }, [spoerg]);

  // Når der er en boks, vises <dialog> som "modal" (oven på alt andet)
  useEffect(() => {
    const el = dialogRef.current;
    if (boks && el && !el.open) el.showModal();
    if (!boks && el && el.open) el.close();
  }, [boks]);

  function svar(vaerdi) {
    boks.svar(vaerdi);
    setBoks(null);
  }

  return (
    <DialogKontekst.Provider value={{ spoerg, bekraeftSlet }}>
      {children}
      <dialog
        ref={dialogRef}
        className="dialog"
        onCancel={(e) => { e.preventDefault(); if (boks) svar(null); }}   // Escape = fortryd
      >
        {boks && (
          <>
            <h3>{boks.titel}</h3>
            <p>{boks.tekst}</p>
            <div className="dialog-knapper">
              {boks.knapper.map((k, i) => (
                <button key={i} className={"knap " + (k.stil || "")} autoFocus={i === 0} onClick={() => svar(k.svar)}>
                  {k.tekst}
                </button>
              ))}
            </div>
          </>
        )}
      </dialog>
    </DialogKontekst.Provider>
  );
}

export function useDialog() {
  return useContext(DialogKontekst);
}
