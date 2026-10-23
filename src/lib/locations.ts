import india from "@/data/india.json";

/**
 * Location ids are hierarchical strings:
 *   global
 *   region:<slug>
 *   country:india
 *   state:<stateSlug>
 *   district:<stateSlug>:<districtSlug>
 *
 * A news item is tagged with its own id plus every ancestor id. Global and
 * each region are separate scopes. Within India the tags roll up: selecting
 * "India" also returns state and district stories, and selecting a state also
 * returns its district stories.
 */

export type LocationKind = "global" | "region" | "country" | "state" | "district";

export interface LocationNode {
  id: string;
  kind: LocationKind;
  label: string;
  /** Text sent to Tavily when this location is searched. */
  query: string;
  /** Ancestor ids, nearest first. */
  ancestors: string[];
  /** For districts: the state label, shown as a hint in the picker. */
  parentLabel?: string;
  /** Lowercase words used to detect mentions inside article text. */
  matchTerms?: string[];
}

interface RawDistrict {
  name: string;
  slug: string;
  aliases?: string[];
}
interface RawState {
  name: string;
  slug: string;
  districts: RawDistrict[];
}

export const REGIONS: { slug: string; label: string; query: string }[] = [
  { slug: "north-america", label: "North America", query: "North America news United States Canada" },
  { slug: "south-america", label: "South America", query: "South America news Brazil Argentina Chile Colombia" },
  { slug: "latam", label: "LATAM", query: "Latin America news Mexico Central America Caribbean" },
  { slug: "eu", label: "EU", query: "European Union news Europe" },
  { slug: "uk", label: "UK", query: "United Kingdom news Britain" },
  { slug: "central-asia", label: "Central Asia", query: "Central Asia news Kazakhstan Uzbekistan Kyrgyzstan Tajikistan Turkmenistan" },
  { slug: "east-asia", label: "East Asia", query: "East Asia news China Japan South Korea Taiwan" },
  { slug: "oceania", label: "Oceania", query: "Oceania news Australia New Zealand Pacific Islands" },
  { slug: "south-asia", label: "South Asia", query: "South Asia news Pakistan Bangladesh Sri Lanka Nepal Bhutan Maldives Afghanistan" },
  { slug: "sea", label: "SEA", query: "Southeast Asia news Indonesia Singapore Malaysia Thailand Vietnam Philippines" },
  { slug: "mena", label: "MENA", query: "Middle East North Africa news" },
  { slug: "rest-of-africa", label: "Rest of Africa", query: "Sub-Saharan Africa news Nigeria Kenya South Africa Ethiopia Ghana" },
  { slug: "maritime", label: "Maritime", query: "maritime shipping news ports navy sea trade" },
];

const STATES = india as RawState[];

const DISTRICT_SUFFIX = /\s+(urban|rural|city|suburban|district)$/i;

function termsFor(name: string, aliases: string[] = []): string[] {
  const out = new Set<string>();
  for (const n of [name, ...aliases]) {
    out.add(n.toLowerCase());
    const stripped = n.replace(DISTRICT_SUFFIX, "");
    if (stripped.length >= 4) out.add(stripped.toLowerCase());
  }
  return [...out];
}

function build(): LocationNode[] {
  const nodes: LocationNode[] = [
    { id: "global", kind: "global", label: "Global", query: "top world news headlines today", ancestors: [] },
  ];
  for (const r of REGIONS) {
    nodes.push({ id: `region:${r.slug}`, kind: "region", label: r.label, query: r.query, ancestors: [] });
  }
  nodes.push({ id: "country:india", kind: "country", label: "India", query: "India news today", ancestors: [] });
  for (const s of STATES) {
    const stateId = `state:${s.slug}`;
    nodes.push({
      id: stateId,
      kind: "state",
      label: s.name,
      query: `${s.name} India news`,
      ancestors: ["country:india"],
      matchTerms: termsFor(s.name),
    });
    for (const d of s.districts) {
      nodes.push({
        id: `district:${s.slug}:${d.slug}`,
        kind: "district",
        label: d.name,
        parentLabel: s.name,
        query: `${d.name} ${s.name} local news`,
        ancestors: [stateId, "country:india"],
        matchTerms: termsFor(d.name, d.aliases),
      });
    }
  }
  return nodes;
}

export const LOCATIONS: LocationNode[] = build();
export const LOCATION_BY_ID: Map<string, LocationNode> = new Map(LOCATIONS.map((l) => [l.id, l]));

export const STATE_NODES = LOCATIONS.filter((l) => l.kind === "state");
export const DISTRICT_NODES = LOCATIONS.filter((l) => l.kind === "district");

export function districtsOfState(stateId: string): LocationNode[] {
  return DISTRICT_NODES.filter((d) => d.ancestors[0] === stateId);
}

/** The node itself plus all ancestors. Used when tagging an article. */
export function tagsFor(id: string): string[] {
  const node = LOCATION_BY_ID.get(id);
  if (!node) return [];
  return [node.id, ...node.ancestors];
}

/** Ids are only ever accepted from this known set, so user input can't inject tags. */
export function isValidLocationId(id: string): boolean {
  return LOCATION_BY_ID.has(id);
}

/** Groups shown in the picker, in display order. */
export const LOCATION_GROUPS: { kind: LocationKind; title: string }[] = [
  { kind: "global", title: "Global" },
  { kind: "region", title: "Regional" },
  { kind: "country", title: "Country" },
  { kind: "state", title: "States and UTs" },
  { kind: "district", title: "Districts" },
];
