export const SECRET_PATTERNS: { name: string; re: RegExp }[];
export function scanText(text: string): string[];
export function scanRepo(root: string): { file: string; line: number; name: string }[];
