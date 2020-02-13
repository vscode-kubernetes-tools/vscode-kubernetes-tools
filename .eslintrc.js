module.exports = {
    "env": {
        "es6": true,
        "node": true
    },
    "parser": "@typescript-eslint/parser",
    "parserOptions": {
        "project": "tsconfig.json",
        "sourceType": "module"
    },
    "plugins": [
        "@typescript-eslint",
        "@typescript-eslint/tslint"
    ],
    "rules": {
        "@typescript-eslint/member-delimiter-style": [
            "warn",
            {
                "multiline": {
                    "delimiter": "semi",
                    "requireLast": true
                },
                "singleline": {
                    "delimiter": "semi",
                    "requireLast": false
                }
            }
        ],
        "@typescript-eslint/prefer-for-of": "error",
        "@typescript-eslint/semi": [
            "warn",
            "always"
        ],
        "@typescript-eslint/type-annotation-spacing": "warn",
        "arrow-parens": [
            "warn",
            "always"
        ],
        "camelcase": "error",
        "curly": [
            "error"
        ],
        "eqeqeq": [
            "error",
            "always"
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
            "as-needed"
        ],
        "spaced-comment": "warn",
        "@typescript-eslint/tslint/config": [
            "warn",
            {
                "rules": {
                    "encoding": true,
                    "no-boolean-literal-compare": true,
                    "no-unused-variable": true,
                    "switch-final-break": [
                        true,
                        "always"
                    ],
                    "whitespace": [
                        true,
                        "check-branch",
                        "check-decl",
                        "check-module",
                        "check-separator",
                        "check-type",
                        "check-preblock"
                    ],
                    "prefer-template": [
                        true,
                        "allow-single-concat"
                    ]
                }
            }
        ]
    }
};
