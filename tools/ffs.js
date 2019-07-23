// TODO: call this from the Webpack afterEmit or done hook instead of explicitly

const fs = require('fs');

const extn = fs.readFileSync('./dist/extension.js', 'utf-8');
const extnLines = extn.split('\n');

const gmiIndex = extnLines.findIndex((l) => l.indexOf('grammar.moduleInclude = fs.readFileSync(/*require.resolve*/') >= 0);
extnLines[gmiIndex] = '  grammar.moduleInclude = fs.readFileSync(require.resolve("jsonpath/include/module.js"));';

const gaiIndex = extnLines.findIndex((l) => l.indexOf('grammar.actionInclude = fs.readFileSync(/*require.resolve*/') >= 0);
extnLines[gaiIndex] = '  grammar.actionInclude = fs.readFileSync(require.resolve("jsonpath/include/action.js"));';

// TODO: find this more bettererly
const esprimaIndex = extnLines.findIndex((l) => l.indexOf('var file = /*require.resolve*/') >= 0);
extnLines[esprimaIndex] = "var file = require.resolve('esprima');";

const extn2 = extnLines.join('\n');
fs.writeFileSync('./dist/extension.js', extn2, 'utf-8');
