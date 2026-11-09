/*
  DATA-KONTEKST – her bor ALLE appens data, og alle sider kan få fat i dem.

  En "kontekst" i React er en måde at dele data med mange komponenter, uden at
  skulle sende dem ned gennem hver eneste komponent som props.

  Brug i en komponent:
      const { data, opdater } = useData();
      data.spillere ...                                  // læs
      opdater(d => { d.spillere.push(nySpiller); });     // ændr

  opdater() laver en KOPI af data, lader dig rette i kopien og gemmer kopien.
  React opdager, at data er nye, og tegner de sider der bruger dem forfra.
  Hver gang data ændrer sig, gemmes de automatisk i browserens hukommelse.
*/
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { hentData, gemData } from "./data/lagring.js";

const DataKontekst = createContext(null);

export function DataUdbyder({ children }) {
  // useState(hentData): hent de gemte data ÉN gang, når appen starter
  const [data, setData] = useState(hentData);

  // Gem automatisk, hver gang data ændrer sig
  useEffect(() => {
    gemData(data);
  }, [data]);

  // Ret i en kopi af data (se forklaringen øverst)
  const opdater = useCallback((aendring) => {
    setData((gammel) => {
      const kopi = structuredClone(gammel);
      aendring(kopi);
      return kopi;
    });
  }, []);

  // Udskift ALLE data på én gang (bruges når man henter en fil)
  const erstat = useCallback((nyeData) => setData(nyeData), []);

  return (
    <DataKontekst.Provider value={{ data, opdater, erstat }}>
      {children}
    </DataKontekst.Provider>
  );
}

// Genvej: const { data, opdater } = useData();
export function useData() {
  return useContext(DataKontekst);
}
