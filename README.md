# 🤾 Playmaker – taktiktavle til håndbold

En React-app til at planlægge opstillinger, tegne og afspille angrebssystemer,
holde styr på spillere og skader, scoute modstandere og registrere kampe live.

## Sådan starter du appen

1. Åbn en terminal i mappen `playmaker`.
2. Første gang (eller hvis `node_modules` mangler):
   ```bash
   npm install
   ```
3. Start udviklingsserveren:
   ```bash
   npm run dev
   ```
4. Åbn **http://localhost:5173** i browseren.

Stop serveren med `Ctrl + C` i terminalen.

## Flyt dine data fra den gamle udgave

1. Åbn den gamle `taktiktavle.html` og tryk **💾 Gem fil**.
2. Åbn Playmaker og tryk **📂 Hent fil** og vælg filen.

Data gemmes i browserens hukommelse (localStorage) på den enkelte computer.
Brug **💾 Gem fil** jævnligt som backup.

## Mappestruktur

```
playmaker/
├── index.html              Selve HTML-siden (React lægger appen i <div id="root">)
├── vite.config.js          Opsætning af Vite (værktøjet der kører appen)
└── src/
    ├── main.jsx            Startpunktet – monterer appen
    ├── App.jsx             Toppen af siden, faner, gem/hent fil
    ├── DataKontekst.jsx    ALLE data, delt mellem siderne (useData)
    ├── Navigation.jsx      Lader en side spørge "vil du gemme?" før man skifter fane
    ├── hjaelpere.js        Små hjælpefunktioner (datoer, sortering, koordinater …)
    ├── animation.js        Matematikken bag animation af systemer
    ├── styles.css          Al styling
    ├── data/
    │   ├── konstanter.js   Roller, pladser, forsvar, farver
    │   ├── standardData.js Startdata og "tomme" ting (nyt system, ny kamp)
    │   └── lagring.js      Gem/hent i localStorage + rens data fra filer
    ├── komponenter/        Genbrugelige dele: banen, trøjer, pile, "Er du sikker?"
    └── sider/              Én fil (eller mappe) pr. fane
```

## Byg en færdig udgave

```bash
npm run build
```

Den færdige app ligger derefter i mappen `dist/`.
