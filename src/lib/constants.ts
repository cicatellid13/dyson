export const WIKI_API =
  "https://dyson-sphere-program.fandom.com/api.php";

export const WIKI_BASE =
  "https://dyson-sphere-program.fandom.com/wiki/";

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
