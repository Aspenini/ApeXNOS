export type Member = {
  name: string;
  /**
   * Basename of the portrait in /public/members, or null for a monogram card.
   * Derivatives are produced by scripts/build-assets.mjs.
   */
  portrait: string | null;
  /** Widths that exist on disk, ascending. Sources are never upscaled. */
  widths: number[];
  /** Per-member accent driving the card glow, edge light and sheen. */
  accent: string;
};

/**
 * The roster. This is the only place member data lives — the card markup is
 * generated from it at build time by build/roster.ts, so adding someone means
 * dropping a portrait in /assets/members, running `bun run assets`, and adding
 * a line here.
 */
export const members: Member[] = [
  { name: "Aspenini", portrait: "aspenini", widths: [400, 800], accent: "#5eead4" },
  { name: "NomadTax", portrait: "nomadtax", widths: [256], accent: "#a3e635" },
  { name: "Heaths", portrait: "heaths", widths: [400], accent: "#38bdf8" },
  { name: "KINGFELTNER", portrait: null, widths: [], accent: "#fb7185" },
  { name: "MrGamer3811", portrait: "mrgamer3811", widths: [400], accent: "#fbbf24" },
  { name: "AbbieRocks", portrait: null, widths: [], accent: "#fb923c" },
  { name: "Ripley", portrait: "ripley", widths: [256], accent: "#a78bfa" },
];
