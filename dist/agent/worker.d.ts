export type AssetsEnv = {
    readonly ASSETS: {
        fetch: (request: Request) => Promise<Response>;
    };
};
export declare function handle(request: Request, env: AssetsEnv): Promise<Response>;
declare const _default: {
    fetch: typeof handle;
};
export default _default;
