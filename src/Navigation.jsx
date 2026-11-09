/*
  NAVIGATION – lader en side "spærre" for at man forlader den.

  Systemer-siden bruger det: har man ikke-gemte ændringer, skal man spørges, før man
  skifter fane. Siden registrerer en "vagt" – en async funktion, der giver true
  (må gerne gå) eller false (bliv her):

      const { saetForladVagt } = useNavigation();
      useEffect(() => {
        saetForladVagt(async () => { ...spørg...; return true/false; });
        return () => saetForladVagt(null);          // fjern vagten når siden lukkes
      }, [...]);
*/
import { createContext, useContext } from "react";

export const NavigationKontekst = createContext(null);

export function useNavigation() {
  return useContext(NavigationKontekst);
}
