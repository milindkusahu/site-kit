// libheif-js is an optional peer dependency with no types for this entry. Only the factory is
// declared; heic.ts checks the shape of what it returns at runtime.
declare module "libheif-js/libheif-wasm/libheif-bundle.mjs" {
  const factory: () => Promise<unknown>;
  export default factory;
}
