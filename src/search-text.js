/** Lowercase, accent-free and trimmed text for searching. */
export const normalizeSearch=text=>String(text).normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().trim();

/** True when every whitespace-separated word of `query` occurs in `text`; a blank query matches everything. */
export function matchesQuery(text,query){
 const haystack=normalizeSearch(text);
 return normalizeSearch(query).split(/\s+/).filter(Boolean).every(token=>haystack.includes(token));
}
