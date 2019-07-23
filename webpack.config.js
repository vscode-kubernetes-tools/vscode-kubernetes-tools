//@ts-check

'use strict';

const path = require('path');
const webpack = require('webpack');

/**@type {import('webpack').Configuration}*/
const config = {
  target: 'node',
  entry: './src/extension.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2',
    devtoolModuleFilenameTemplate: '../[resource-path]'
  },
  devtool: 'source-map',
  externals: {
    vscode: 'commonjs vscode',
    bufferutil: 'commonjs bufferutil',
    // '../build/Release/bufferutil': 'commonjs ../build/Release/bufferutil',
    // '../build/default/bufferutil': 'commonjs ../build/default/bufferutil',
    // validation: 'commonjs validation',
    // '../build/Release/validation': 'commonjs ../build/Release/validation',
    // '../build/default/validation': 'commonjs ../build/default/validation',
    'spawn-sync': 'commonjs spawn-sync',
    'utf-8-validate': 'commonjs utf-8-validate'
    // 'esprima': 'commonjs esprima'
  },
  plugins: [
      new webpack.IgnorePlugin(/^electron$/)
  ],
  resolve: {
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
