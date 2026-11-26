/** agentLinks: false leaves out the Link header that points agents at /llms.txt and /sitemap.xml (default true). wasm: true adds 'wasm-unsafe-eval' to script-src, for WebAssembly such as the HEIC decoder in site-kit/image/heic. */
export type HeaderOptions = { dev?: boolean; ads?: string; analytics?: boolean; agentLinks?: boolean; wasm?: boolean };
export function securityHeaders(options?: HeaderOptions): { key: string; value: string }[];
export function headersFile(options?: HeaderOptions): string;
export function headerProblems(headers: Headers): string[];
export const REQUIRED_HEADERS: string[];
