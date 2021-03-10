// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require("path");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const HtmlWebPackPlugin = require( 'html-webpack-plugin' );

module.exports = {
  entry: {
    index: "./src/components/logs/app/main.js",
    webviewElements: [
      "./node_modules/@bendera/vscode-webview-elements/dist/bundled.js",
      "./node_modules/vscode-codicons/dist/codicon.css"
    ]
  },
  output: {
    path: path.resolve(__dirname, '..', '..', '..', 'dist', 'logView')
  },
  devtool: "eval-source-map",
  resolve: {
    extensions: [".js", ".ts", ".json", ".css"]
  },
  module: {
    rules: [
        {
            test: /\.(ts|tsx)$/,
            loader: "ts-loader",
            options: {}
        },
        {
            test: /\.css$/,
            use: [
            {
                loader: "style-loader"
            },
            {
                loader: "css-loader"
            }
            ]
        },
        {
          test: /\.ttf$/,
          use: [
            {
              loader: 'ttf-loader',
              options: {
                name: './font/[hash].[ext]',
              },
            },
          ]
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