// eslint-disable-next-line @typescript-eslint/no-var-requires
import { resolve as _resolve } from "path";
// eslint-disable-next-line @typescript-eslint/no-var-requires
import HtmlWebPackPlugin from 'html-webpack-plugin';

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const entry = {
    ansiToHtml: [
        "./node_modules/ansi-to-html/lib/ansi_to_html.js"
    ],
    index: "./src/components/logs/app/main.js",
    webviewElements: [
        "./node_modules/@bendera/vscode-webview-elements/dist/bundled.js"
    ],
};
export const output = {
    path: _resolve(__dirname, '..', '..', '..', 'dist', 'logView')
};
export const devtool = "eval-source-map";
export const resolve = {
    extensions: [".js", ".ts", ".json"]
};
export default {
    mode: 'none', // Add mode here
    entry: {
        index: "./src/components/logs/app/main.js",
        webviewElements: [
            "./node_modules/@bendera/vscode-webview-elements/dist/bundled.js"
        ],
    },
    // Other config options...
  };
export const module = {
    rules: [
        {
            test: /\.(ts|tsx)$/,
            loader: "ts-loader",
            options: {}
        }
    ]
};
export const performance = {
    hints: false
};
export const plugins = [
    new HtmlWebPackPlugin({
        template: _resolve(__dirname, './app/index.html'),
        filename: 'index.html'
    })
];
