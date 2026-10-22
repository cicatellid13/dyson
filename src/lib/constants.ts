export const WIKI_ORIGIN = "https://dyson-sphere-program.fandom.com";

export const WIKI_API = `${WIKI_ORIGIN}/api.php`;

export const WIKI_BASE = `${WIKI_ORIGIN}/wiki/`;

export const USER_AGENT = "DSP-Wiki-Desktop/1.0 (personal reference client)";

export const HOME_PAGE = "Dyson Sphere Program Wiki";

export const SHORTCUTS = [
  { label: "Home", page: HOME_PAGE },
  { label: "Components", page: "Components" },
  { label: "Buildings", page: "Buildings" },
  { label: "Technology", page: "Technology" },
] as const;

export const RECENTS_KEY = "dsp-wiki-recent";
export const RECENTS_MAX = 20;
