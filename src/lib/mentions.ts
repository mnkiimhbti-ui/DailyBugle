import { LOCATION_BY_ID, STATE_NODES, districtsOfState, tagsFor, type LocationNode } from "@/lib/locations";

/**
 * There are 700+ Indian districts but the Tavily free tier allows ~16 searches
 * per run, so districts are mostly covered by *tagging*: when an India or state
 * level article mentions a district by name, it gets that district's tags too.
 */

const regexCache = new Map<string, RegExp>();
function termRegex(term: string): RegExp {
  let re = regexCache.get(term);
  if (!re) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    re = new RegExp(`(^|[^\\p{L}])${escaped}(?=$|[^\\p{L}])`, "iu");
    regexCache.set(term, re);
  }
  return re;
}

function mentions(text: string, node: LocationNode): boolean {
  return (node.matchTerms ?? []).some((t) => termRegex(t).test(text));
}

/** All location tags for an article found by searching `queriedId`. */
export function tagArticle(queriedId: string, text: string): string[] {
  const tags = new Set(tagsFor(queriedId));
  const node = LOCATION_BY_ID.get(queriedId);
  if (!node) return [...tags];

  let candidates: LocationNode[] = [];
  if (node.kind === "country") {
    // India level story: detect which states it is about.
    candidates = STATE_NODES;
  } else if (node.kind === "state") {
    candidates = districtsOfState(node.id);
  }

  for (const c of candidates) {
    if (!mentions(text, c)) continue;
    for (const t of tagsFor(c.id)) tags.add(t);
    // A state mentioned in an India story: also scan that state's districts.
    if (c.kind === "state") {
      for (const d of districtsOfState(c.id)) {
        if (mentions(text, d)) for (const t of tagsFor(d.id)) tags.add(t);
      }
    }
  }
  return [...tags];
}
