export type ShareLink = {
    readonly network: string;
    readonly label: string;
    readonly href: string;
};
export declare function shareLinks(url: string, title: string): readonly ShareLink[];
