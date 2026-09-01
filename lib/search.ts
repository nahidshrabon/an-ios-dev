/**
 * Shared text-matching used by the Articles and Roadmap browsers so both
 * behave identically: a query is split into terms, and every term must
 * appear somewhere in the haystack (order-independent).
 */

export function toSearchTerms(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}

export function matchesAllTerms(haystack: string, terms: string[]): boolean {
  return terms.every((term) => haystack.includes(term));
}
