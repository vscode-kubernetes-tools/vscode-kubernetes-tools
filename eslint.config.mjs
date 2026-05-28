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
        },
    },
];
