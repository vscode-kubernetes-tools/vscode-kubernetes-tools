// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require("path");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const HtmlWebPackPlugin = require( 'html-webpack-plugin' );

module.exports = {
  entry: {
    ansiToHtml: [
      "./node_modules/ansi-to-html/lib/ansi_to_html.js"
    ],
    index: "./src/components/logs/app/main.js",
    webviewElements: [
      "./node_modules/@bendera/vscode-webview-elements/dist/bundled.js"
    ],
  },
  output: {
    path: path.resolve(__dirname, '..', '..', '..', 'dist', 'logView')
  },
  devtool: "eval-source-map",
  resolve: {
    extensions: [".js", ".ts", ".json"]
  },
  module: {
    rules: [
        {
            test: /\.(ts|tsx)$/,
            loader: "ts-loader",
            options: {}
        }
    ]
  },
  performance: {
    hints: false
  },
  plugins: [
     new HtmlWebPackPlugin({
        template: path.resolve( __dirname, './app/index.html' ),
        filename: 'index.html'
     })
  ]
};