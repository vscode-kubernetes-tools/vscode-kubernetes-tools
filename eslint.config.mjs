import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

export default [
    {
        ignores: ["src/**/*.js", "src/**/*.mjs"],
    },
    {
        files: ["src/**/*.ts"],
        languageOptions: {
            ecmaVersion: 2015,
            globals: {
                ...globals.es2015,
                ...globals.node,
            },
            parser: tsParser,
            parserOptions: {
                project: "tsconfig.json",
                sourceType: "module",
            },
        },
        plugins: {
            "@typescript-eslint": tsPlugin,
        },
        rules: {
            "@typescript-eslint/prefer-for-of": "error",
            "@typescript-eslint/no-unnecessary-boolean-literal-compare": "warn",
            "arrow-parens": [
                "warn",
                "always",
            ],
            "camelcase": "error",
            "curly": [
                "error",
            ],
            "eqeqeq": [
                "error",
                "always",
            ],
            "id-match": "error",
            "no-debugger": "error",
            "no-multiple-empty-lines": "warn",
            "no-trailing-spaces": "warn",
            "no-underscore-dangle": "warn",
            "no-var": "error",
            "prefer-const": "error",
            "prefer-template": "off",
            "quote-props": [
                "error",
                "as-needed",
            ],
            "spaced-comment": "warn",
            "no-restricted-imports": [
                "error",
                {
                    paths: [
                        {
                            name: "shelljs",
                            message: "Use src/process.ts with executable and argv instead of shell command strings.",
                        },
                    ],
                    patterns: [
                        {
                            group: ["child_process"],
                            message: "Centralize process creation in src/process.ts; use type-only imports elsewhere.",
                        },
                    ],
                },
            ],
            "no-restricted-syntax": [
                "error",
                {
                    selector: "CallExpression[callee.type='MemberExpression'][callee.property.name='sendText']",
                    message: "Do not send executable command text to an integrated terminal; launch an executable with shellArgs.",
                },
            ],
        },
    },
    {
        files: [
            "src/process.ts",
        ],
        rules: {
            "no-restricted-imports": "off",
        },
    },
];
