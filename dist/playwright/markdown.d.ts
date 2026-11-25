export type MarkdownCheck = {
    readonly path: string;
    readonly heading: RegExp;
};
export declare function markdownTests({ path, heading }: MarkdownCheck): void;
