import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    ignores: ["src/app/dev/**", "src/dev/**"],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // Guardrail: flag files growing into monoliths. Warning-only, so it never
    // fails CI — it surfaces the refactor backlog and catches new god-files
    // before they get out of hand. Tests are exempt (fixtures can be long).
    files: ["src/**/*.{ts,tsx}"],
    ignores: [
      "src/**/__tests__/**",
      "src/**/*.test.{ts,tsx}",
      "src/games/shared/gameTestHarness.ts",
    ],
    rules: {
      "max-lines": [
        "warn",
        { max: 1500, skipBlankLines: true, skipComments: true },
      ],
    },
  },
];

export default eslintConfig;
