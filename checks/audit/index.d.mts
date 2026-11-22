export type AuditProblem = { rule: string; url: string; message: string };
export function runAudit(base: string, options?: { launch?: boolean; root?: string }): Promise<{ problems: AuditProblem[]; pages: number }>;
export function formatProblems(problems: AuditProblem[]): string;
export const CONTENT_TYPES: Set<string>;
