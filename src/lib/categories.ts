/**
 * Topic categories, assigned by keyword matching on title and text.
 * Free (no API calls) and deterministic. Title matches count double.
 * An item gets up to two categories; anything unmatched is "general".
 * Edit the keyword lists freely; the sync backfills untagged items.
 */

export interface Category {
  id: string;
  label: string;
  keywords: string[];
}

export const CATEGORIES: Category[] = [
  {
    id: "politics",
    label: "Politics",
    keywords: [
      "election", "elections", "minister", "ministry", "parliament", "lok sabha", "rajya sabha", "assembly", "mla", "bjp", "congress",
      "aap", "samajwadi", "government", "cabinet", "prime minister", "chief minister", "president", "senate", "governor", "vote", "voters",
      "poll", "polls", "campaign", "opposition", "policy", "diplomat", "diplomatic", "summit", "sanctions", "treaty", "modi", "yogi",
    ],
  },
  {
    id: "business",
    label: "Business and Finance",
    keywords: [
      "market", "markets", "stock", "stocks", "shares", "sensex", "nifty", "ipo", "investor", "investors", "economy", "economic", "gdp",
      "inflation", "rbi", "interest rate", "bank", "banking", "revenue", "profit", "earnings", "quarterly", "startup", "funding", "valuation",
      "acquisition", "merger", "rupee", "dollar", "trade", "tariff", "budget", "tax", "gst", "crypto", "bitcoin", "fiscal", "exports", "imports",
    ],
  },
  {
    id: "technology",
    label: "Technology",
    keywords: [
      "ai", "artificial intelligence", "tech", "technology", "software", "apps", "smartphone", "iphone", "android", "google", "apple",
      "microsoft", "meta", "openai", "chip", "chips", "semiconductor", "cyber", "cybersecurity", "hack", "data breach", "gadget", 
      "5g", "internet", "startup", "robot", "robotics", "ev", "electric vehicle",
    ],
  },
  {
    id: "sports",
    label: "Sports",
    keywords: [
      "cricket", "ipl", "football", "fifa", "hockey", "tennis", "badminton", "olympic", "olympics", "match", "tournament", "league", "cup",
      "wicket", "century", "coach", "squad", "athlete", "medal", "championship", "kabaddi", "wrestling", "bcci", "test match",
      "odi", "t20", "kohli", "rohit", "premier league", "grand slam", "formula 1", "f1",
    ],
  },
  {
    id: "entertainment",
    label: "Entertainment",
    keywords: [
      "film", "films", "movie", "movies", "bollywood", "hollywood", "box office", "actor", "actress", "celebrity", "trailer", "teaser",
      "song", "album", "music", "concert", "netflix", "ott", "web series", "tv", "reality show", "director",
      "premiere", "awards", "oscar", "grammy", "singer", "rapper",
    ],
  },
  {
    id: "health",
    label: "Health",
    keywords: [
      "health", "hospital", "doctor", "doctors", "patients", "disease", "virus", "outbreak", "vaccine", "medical", "medicine", "covid",
      "dengue", "malaria", "cancer", "diabetes", "aiims", "fitness", "diet", "mental health", "surgery", "healthcare",
    ],
  },
  {
    id: "science",
    label: "Science and Space",
    keywords: ["science", "scientist", "scientists", "research", "study", "isro", "nasa", "space", "satellite", "rocket", "moon", "mars", "chandrayaan", "gaganyaan", "astronomy", "physics", "discovery"],
  },
  {
    id: "environment",
    label: "Environment and Weather",
    keywords: [
      "weather", "rain", "rainfall", "monsoon", "flood", "floods", "cyclone", "storm", "heatwave", "heat wave", "cold wave", "fog", "imd",
      "climate", "pollution", "aqi", "air quality", "earthquake", "landslide", "drought", "wildlife", "forest", "environment",
    ],
  },
  {
    id: "crime",
    label: "Crime and Law",
    keywords: [
      "police", "arrested", "arrest", "murder", "killed", "crime", "fraud", "scam", "court", "high court", "supreme court", "judge",
      "verdict", "bail", "fir", "accused", "theft", "robbery", "cbi", "investigation", "lawsuit", "sentenced",
    ],
  },
  {
    id: "education",
    label: "Education and Jobs",
    keywords: ["school", "schools", "college", "university", "students", "exam", "exams", "board exam", "neet", "jee", "upsc", "cbse", "results", "admission", "recruitment", "jobs", "vacancy", "teachers"],
  },
];

export const GENERAL = { id: "general", label: "General" };

export const ALL_CATEGORIES = [...CATEGORIES.map(({ id, label }) => ({ id, label })), GENERAL];
export const CATEGORY_LABEL = new Map(ALL_CATEGORIES.map((c) => [c.id, c.label]));
export const isValidCategory = (id: string) => CATEGORY_LABEL.has(id);

const compiled = CATEGORIES.map((c) => ({
  id: c.id,
  res: c.keywords.map((k) => new RegExp(`(^|[^\\p{L}\\p{N}])${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[^\\p{L}\\p{N}])`, "iu")),
}));

export function categorize(title: string, body = ""): string[] {
  const scored = compiled
    .map((c) => ({
      id: c.id,
      score: c.res.reduce((s, re) => s + (re.test(title) ? 2 : 0) + (re.test(body) ? 1 : 0), 0),
    }))
    .filter((c) => c.score >= 2)
    .sort((a, b) => b.score - a.score);
  if (scored.length === 0) return [GENERAL.id];
  const top = scored[0].score;
  // Second category only if it is a strong match too.
  return scored.filter((c, i) => i === 0 || (i === 1 && c.score >= Math.max(3, top * 0.6))).map((c) => c.id);
}
