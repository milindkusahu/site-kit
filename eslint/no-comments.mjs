const noComments = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow comments in application code. Agents use comments to justify workarounds and copy them.",
    },
    schema: [
      {
        type: "object",
        properties: { allow: { type: "array", items: { type: "string" } } },
        additionalProperties: false,
      },
    ],
    messages: {
      noComment:
        "No comments. Put intent in names and types. If a workaround needs explaining, fix the root cause or add a lint rule instead.",
    },
  },
  create(context) {
    const allow = (context.options[0]?.allow ?? []).map((p) => new RegExp(p));
    const sourceCode = context.sourceCode;
    return {
      Program() {
        for (const comment of sourceCode.getAllComments()) {
          if (comment.type === "Shebang") continue;
          if (allow.some((re) => re.test(comment.value))) continue;
          context.report({ loc: comment.loc, messageId: "noComment" });
        }
      },
    };
  },
};

export default noComments;
