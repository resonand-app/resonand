window.SonariumKit = window.SonariumKit || {};
(function () {
  const LIBRARIES = [
    { id: "personal",  name: "Personal",           colour: "var(--library-amber)", count: 84,  duration: "31 h 12 min", seed: 3 },
    { id: "avia",      name: "Àvia Teresa",        colour: "var(--library-clay)",  count: 3,   duration: "2 h 04 min",  seed: 34, played: 0.34 },
    { id: "tesi",      name: "Entrevistes — tesi", colour: "var(--library-slate)", count: 112, duration: "68 h 41 min", seed: 65 },
    { id: "assajos",   name: "Assajos",            colour: "var(--library-moss)",  count: 26,  duration: "12 h 30 min", seed: 96 },
    { id: "notes",     name: "Notes de veu",       colour: "var(--library-stone)", count: 208, duration: "21 h 07 min", seed: 127 },
    { id: "ateneu",    name: "Reunions Ateneu",    colour: "var(--library-plum)",  count: 41,  duration: "9 h 18 min",  seed: 158, shared: true },
    { id: "ocells",    name: "Cants d'ocells",     colour: "var(--library-teal)",  count: 63,  duration: "4 h 52 min",  seed: 189 }
  ];

  const RECORDINGS = [
    { id: "carrer-nou", name: "The house on Carrer Nou",       duration: "48:12", date: "12 Mar 2026", state: "done",    seed: 41, tags: ["memòria", "català"] },
    { id: "nadal",      name: "Sopar de Nadal 1998",           duration: "12:07", date: "12 Mar 2026", state: "done",    seed: 42, tags: ["família"] },
    { id: "cancons",    name: "Cançons que cantava la mare",    duration: "31:55", date: "09 Mar 2026", state: "running", seed: 43, tags: ["música"] },
    { id: "nota",       name: "Nota de veu 12 mar",             duration: "01:48", date: "12 Mar 2026", state: "none",    pending: true, tags: [] }
  ];

  const TRANSCRIPT = [
    { at: "17:31", text: "My mother was born in the village, but she never talked about it much." },
    { at: "17:52", text: "I remember the stairs were always cold, even in August." },
    { at: "18:04", text: "The house on Carrer Nou had a balcony that looked over the square, and every Sunday my mother would hang the sheets there." },
    { at: "18:19", text: "We stayed until the year my grandfather died." },
    { at: "18:31", text: "After that nobody wanted to go back." },
    { at: "18:44", text: "The building is still there. Somebody painted the shutters green." }
  ];

  const HITS = [
    { kind: "recording", title: "The house on Carrer Nou", excerpt: "…la casa del carrer Nou, on vivia la meva àvia…", at: "18:04" },
    { kind: "recording", title: "Sopar de Nadal 1998",     excerpt: "…vam anar al carrer Nou a buscar-la…",        at: "04:12" },
    { kind: "library",   title: "Àvia Teresa",             excerpt: "Library · 3 recordings" }
  ];

  Object.assign(window.SonariumKit, { LIBRARIES, RECORDINGS, TRANSCRIPT, HITS });
})();
