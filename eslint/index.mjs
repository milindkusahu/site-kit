import boundariesRule from "./boundaries.mjs";
import noBarrelRule from "./no-barrel.mjs";
import noCommentsRule from "./no-comments.mjs";

const plugin = {
  meta: { name: "local" },
  rules: {
    boundaries: boundariesRule,
    "no-barrel": noBarrelRule,
    "no-comments": noCommentsRule,
  },
};

export default plugin;
