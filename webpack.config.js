//@ts-check

'use strict';

const path = require('path');
const webpack = require('webpack');

/**@type {import('webpack').Configuration}*/
const config = {
  target: 'node', // vscode extensions run in a Node.js-context 📖 -> https://webpack.js.org/configuration/node/

  entry: './src/extension.ts', // the entry point of this extension, 📖 -> https://webpack.js.org/configuration/entry-context/
  output: {
    // the bundle is stored in the 'dist' folder (check package.json), 📖 -> https://webpack.js.org/configuration/output/
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2',
    devtoolModuleFilenameTemplate: '../[resource-path]'
  },
  devtool: 'source-map',
  externals: {
    vscode: 'commonjs vscode', // the vscode-module is created on-the-fly and must be excluded. Add other modules that cannot be webpack'ed, 📖 -> https://webpack.js.org/configuration/externals/
    bufferutil: 'commonjs bufferutil',
    '../build/Release/bufferutil': 'commonjs ../build/Release/bufferutil',
    '../build/default/bufferutil': 'commonjs ../build/default/bufferutil',
    validation: 'commonjs validation',
    '../build/Release/validation': 'commonjs ../build/Release/validation',
    '../build/default/validation': 'commonjs ../build/default/validation',
    'spawn-sync': 'commonjs spawn-sync',
    jsonpath: 'commonjs jsonpath' /*,
    'cross-spawn': 'commonjs cross-spawn',
    '@kubernetes/client-node': 'commonjs @kubernetes/client-node' */
  },
  plugins: [
      new webpack.IgnorePlugin(/^electron$/)
  ],
  resolve: {
    // support reading TypeScript and JavaScript files, 📖 -> https://github.com/TypeStrong/ts-loader
    extensions: ['.ts', '.js', '.json']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader'
          }
        ]
      },
      {
          test: /\.yaml$/,
          use: ['file-loader']
      }
    ]
  }
};
module.exports = config;
