import path from "node:path";
import { RuleTester } from "eslint";
import { afterAll, describe, it } from "vitest";
import boundaries from "./boundaries.mjs";
import noBarrel from "./no-barrel.mjs";
import noComments from "./no-comments.mjs";

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const tester = new RuleTester();
const at = (rel) => path.join(process.cwd(), rel);

const options = [
  {
    aliases: { "@/": "src/" },
    featuresDir: "src/features",
    layers: [
      { name: "app", dir: "src/app", canImport: ["features", "ui", "lib"] },
      { name: "features", dir: "src/features", canImport: ["features", "ui", "lib"] },
      { name: "ui", dir: "src/ui", canImport: ["lib"] },
      { name: "lib", dir: "src/lib", canImport: [] },
    ],
  },
];

tester.run("no-comments", noComments, {
  valid: [
    { code: "const total = price * quantity;" },
    { code: "#!/usr/bin/env node\nrun();" },
    { code: "/* @license MIT */ run();", options: [{ allow: ["^\\s*@license"] }] },
    {
      code: "// @see https://github.com/acme/app/issues/42\nrun();",
      options: [{ allow: ["^\\s*@see https?://\\S+\\s*$"] }],
    },
  ],
  invalid: [
    { code: "// quick fix, proper fix needs bigger changes\nsetup();", errors: [{ messageId: "noComment" }] },
    { code: "// @ts-expect-error legacy type\nrun();", errors: [{ messageId: "noComment" }] },
    {
      code: "// @see https://github.com/acme/app/issues/42 timer needed until then\nrun();",
      options: [{ allow: ["^\\s*@see https?://\\S+\\s*$"] }],
      errors: [{ messageId: "noComment" }],
    },
  ],
});

tester.run("boundaries", boundaries, {
  valid: [
    { code: "import { slugify } from '@/lib/slugify';", filename: at("src/app/page.tsx"), options },
    { code: "import { Greeting } from '@/features/greeting';", filename: at("src/app/page.tsx"), options },
    { code: "import { Greeting } from '@/features/greeting/greeting';", filename: at("src/app/page.tsx"), options },
    { code: "import { helper } from './internal/helper';", filename: at("src/features/greeting/greeting.tsx"), options },
    { code: "import { Button } from './button';", filename: at("src/features/greeting/greeting.tsx"), options },
    { code: "import React from 'react';", filename: at("src/lib/x.ts"), options },
    { code: "import { a } from './other';", filename: at("src/lib/x.ts"), options },
  ],
  invalid: [
    {
      code: "import { Greeting } from '@/features/greeting';",
      filename: at("src/lib/x.ts"),
      options,
      errors: [{ messageId: "layer" }],
    },
    {
      code: "import { Greeting } from '../features/greeting';",
      filename: at("src/ui/card.tsx"),
      options,
      errors: [{ messageId: "layer" }],
    },
    {
      code: "import { helper } from '@/features/greeting/internal/helper';",
      filename: at("src/app/page.tsx"),
      options,
      errors: [{ messageId: "internalFeature" }],
    },
    {
      code: "export { helper } from '../greeting/internal/helper';",
      filename: at("src/features/billing/billing.ts"),
      options,
      errors: [{ messageId: "internalFeature" }],
    },
  ],
});

tester.run("no-barrel", noBarrel, {
  valid: [
    { code: "export const a = 1;" },
    { code: "import { a } from './a';\nexport const b = a + 1;" },
    { code: "export { a } from './a';\nexport const b = 2;" },
  ],
  invalid: [
    { code: "export { Greeting } from './greeting';", errors: [{ messageId: "barrel" }] },
    { code: "export * from './a';\nexport { b } from './b';", errors: [{ messageId: "barrel" }] },
    { code: "export { default as Faq } from './Faq.astro';", errors: [{ messageId: "barrel" }] },
  ],
});
