export type HeaderOptions = { dev?: boolean; ads?: string; analytics?: boolean };
export function securityHeaders(options?: HeaderOptions): { key: string; value: string }[];
export function headersFile(options?: HeaderOptions): string;
export function headerProblems(headers: Headers): string[];
export const REQUIRED_HEADERS: string[];
