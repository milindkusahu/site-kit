const reexports = new Set(["ExportAllDeclaration"]);

function isReexport(statement) {
  if (reexports.has(statement.type)) return true;
  return statement.type === "ExportNamedDeclaration" && statement.source !== null && statement.declaration === null;
}

const noBarrel = {
  meta: {
    type: "suggestion",
    docs: { description: "Disallow barrel files: modules that only re-export other modules." },
    schema: [],
    messages: {
      barrel: "Barrel file. Delete it and import from the module that defines the thing.",
    },
  },
  create(context) {
    return {
      Program(node) {
        const body = node.body.filter((s) => s.type !== "EmptyStatement");
        if (body.length > 0 && body.every(isReexport)) context.report({ node, messageId: "barrel" });
      },
    };
  },
};

export default noBarrel;
