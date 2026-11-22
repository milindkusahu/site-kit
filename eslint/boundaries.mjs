import path from "node:path";

const toPosix = (p) => p.split(path.sep).join("/");

function layerOf(relPath, layers) {
  return layers.find((l) => relPath === l.dir || relPath.startsWith(`${l.dir}/`));
}

function resolveTarget(source, fileAbs, cwd, aliases) {
  for (const [prefix, dir] of Object.entries(aliases)) {
    if (source.startsWith(prefix)) return toPosix(path.join(dir, source.slice(prefix.length)));
  }
  if (source.startsWith(".")) {
    return toPosix(path.relative(cwd, path.resolve(path.dirname(fileAbs), source)));
  }
  return null;
}

function featureName(relPath, featuresDir) {
  if (!relPath.startsWith(`${featuresDir}/`)) return null;
  return relPath.slice(featuresDir.length + 1).split("/")[0] ?? null;
}

function isInternal(relPath, featuresDir, name) {
  return relPath.startsWith(`${featuresDir}/${name}/internal/`);
}

const boundaries = {
  meta: {
    type: "problem",
    docs: { description: "Enforce which folders may import which, so the folder tree tells agents the rules." },
    schema: [
      {
        type: "object",
        properties: {
          aliases: { type: "object", additionalProperties: { type: "string" } },
          featuresDir: { type: "string" },
          layers: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                dir: { type: "string" },
                canImport: { type: "array", items: { type: "string" } },
              },
              required: ["name", "dir", "canImport"],
              additionalProperties: false,
            },
          },
        },
        required: ["layers"],
        additionalProperties: false,
      },
    ],
    messages: {
      layer: "'{{from}}' code may not import from '{{to}}'. Allowed: {{allowed}}.",
      internalFeature:
        "'{{path}}' is internal to feature '{{name}}'. Import one of its top-level files instead, or move the shared code to lib.",
    },
  },
  create(context) {
    const { layers, aliases = {}, featuresDir = "src/features" } = context.options[0];
    const cwd = context.cwd;
    const fileAbs = context.filename;
    const fileRel = toPosix(path.relative(cwd, fileAbs));
    const fromLayer = layerOf(fileRel, layers);
    if (!fromLayer) return {};
    const fromFeature = featureName(fileRel, featuresDir);

    function check(node) {
      if (!node.source || typeof node.source.value !== "string") return;
      const target = resolveTarget(node.source.value, fileAbs, cwd, aliases);
      if (!target) return;
      const toLayer = layerOf(target, layers);
      if (!toLayer) return;
      if (toLayer !== fromLayer && !fromLayer.canImport.includes(toLayer.name)) {
        context.report({
          node: node.source,
          messageId: "layer",
          data: { from: fromLayer.name, to: toLayer.name, allowed: [fromLayer.name, ...fromLayer.canImport].join(", ") },
        });
        return;
      }
      const toFeature = featureName(target, featuresDir);
      if (toFeature && toFeature !== fromFeature && isInternal(target, featuresDir, toFeature)) {
        context.report({ node: node.source, messageId: "internalFeature", data: { name: toFeature, path: target } });
      }
    }

    return {
      ImportDeclaration: check,
      ExportNamedDeclaration: check,
      ExportAllDeclaration: check,
      ImportExpression: check,
    };
  },
};

export default boundaries;
