function capitaliseNamePart(part: string): string {
  if (!part) {
    return part;
  }

  return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
}

function capitaliseNameToken(token: string): string {
  return token
    .split(/(['-])/)
    .map((segment) => {
      if (segment === "'" || segment === "-") {
        return segment;
      }

      return capitaliseNamePart(segment);
    })
    .join("");
}

/** Title-case person names at write time: "john smith" → "John Smith", "o'brien" → "O'Brien". */
export function normalisePersonName(name: string | null | undefined): string {
  if (!name?.trim()) {
    return "";
  }

  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(capitaliseNameToken)
    .join(" ");
}
