/**
 * Formats a raw concept key or gap identifier (e.g., 'hashable_object_mutation')
 * into a human-readable title case string ('Hashable Object Mutation').
 */
export function formatConceptName(name: string | null | undefined): string {
  if (!name) return "";

  // If the string is already formatted with spaces and proper casing, preserve it
  if (!name.includes("_") && /[A-Z]/.test(name)) {
    return name;
  }

  return name
    .replace(/_/g, " ")
    .trim()
    .split(/\s+/)
    .map((word) => {
      // Preserve acronyms or short uppercase terms like IO, CPU, GIL
      if (word.length <= 3 && word.toUpperCase() === word) {
        return word.toUpperCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

/**
 * Formats mastery level strings for UI badges ('developing' -> 'Developing')
 */
export function formatMasteryLevel(level: string | null | undefined): string {
  if (!level) return "Unknown";
  return level.charAt(0).toUpperCase() + level.slice(1).toLowerCase();
}
