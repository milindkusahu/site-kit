import local from "./index.mjs";

export const BANNED_LIBRARIES = {
  group: [
    "clsx",
    "classnames",
    "tailwind-merge",
    "class-variance-authority",
    "lucide-react",
    "lucide-astro",
    "react-icons",
    "react-icons/*",
    "@heroicons/*",
    "@radix-ui/*",
    "@headlessui/*",
    "@mui/*",
    "@chakra-ui/*",
    "antd",
  ],
  message: "No UI framework, icon library or class-name helper. Icons are hand-rolled inline SVG; styles go in a co-located .module.css or a scoped <style>.",
};

export const TIMERS = ["setTimeout", "setInterval", "requestAnimationFrame", "requestIdleCallback"];
const TIMER = "No timer workarounds. Fix the root cause (state, ordering, or a real event).";
export const ALLOWED_COMMENTS = ["^\\s*@license\\b", "^\\s*@see https?://\\S+\\s*$"];
export const NOT_CONFIG = ["**/*.config.{js,mjs,cjs,ts}"];

export function timerBans({ files, ignores = ["src/lib/timing/**"] }) {
  return {
    files,
    ignores,
    rules: {
      "no-restricted-globals": ["error", ...TIMERS.map((name) => ({ name, message: TIMER }))],
      "no-restricted-properties": [
        "error",
        ...["window", "globalThis", "self"].flatMap((object) => TIMERS.map((property) => ({ object, property, message: TIMER }))),
      ],
    },
  };
}

export function qualityRules({ code, src, ignores = [] }) {
  return [
    { linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: "error" } },
    {
      files: code,
      ignores: [...NOT_CONFIG, ...ignores],
      plugins: { local },
      rules: {
        "local/no-comments": ["error", { allow: ALLOWED_COMMENTS }],
        "local/no-barrel": "error",
        "max-lines": ["error", { max: 300, skipBlankLines: true }],
        "@typescript-eslint/no-explicit-any": "error",
      },
    },
    {
      files: src,
      rules: {
        "max-statements": ["error", 12],
        complexity: ["error", 10],
        "max-depth": ["error", 3],
        "max-params": ["error", 3],
      },
    },
  ];
}

export const typedRules = {
  "@typescript-eslint/consistent-type-assertions": ["error", { assertionStyle: "never" }],
  "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
};

export { local };
