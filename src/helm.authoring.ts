import * as vscode from 'vscode';
import * as path from 'path';
import * as yaml from 'js-yaml';
import * as _ from 'lodash';
import { FS } from './fs';
import { Host } from './host';
import { isKubernetesExplorerResourceNode } from './components/clusterexplorer/explorer';
import { helmCreateCore } from './helm.exec';
import { failed, Errorable } from './errorable';
import { symbolAt, containmentChain, findKeyPath, FoundKeyPath, HelmDocumentSymbolProvider } from './helm.symbolProvider';
import { ClusterExplorerResourceNode } from './components/clusterexplorer/node';
import * as cancellation from './utils/cancellation';

interface Context {
    readonly fs: FS;
    readonly host: Host;
    readonly projectPath: string;
}

interface Chart {
    name: string;
    path: string;
}

export async function convertToTemplate(fs: FS, host: Host, projectPath: string, target: vscode.Uri | ClusterExplorerResourceNode | undefined): Promise<void> {
    const context = { fs, host, projectPath };
    const activeDocument = host.activeDocument();
    if (isKubernetesExplorerResourceNode(target)) {
        // it's a k8s explorer click
        const uri = target.uri('yaml');
        const yaml = (await host.readDocument(uri)).getText();
        addChart(context, yaml);
    }  else if (target) {
        // it's a file explorer click
        addChartFrom(context, target.fsPath);
    } else if (activeDocument) {
        addChart(context, activeDocument.getText());
    } else {
        host.showErrorMessage("This command requires a YAML file open or selected in the Explorer.");
    }
}

async function addChartFrom(context: Context, fsPath: string): Promise<void> {
    const yaml = context.fs.readFileSync(fsPath, 'utf-8');
    await addChart(context, yaml);
}

async function addChart(context: Context, resourceYaml: string): Promise<void> {
    // TODO: check text is valid YAML
    const chart = await pickOrCreateChart(context);
    if (!chart) {
        return;
    }

    const template = yaml.safeLoad(resourceYaml);
    templatise(template);

    // TODO: offer a default
    const templateName = await context.host.showInputBox({ prompt: "Name for the new template" });
    if (!templateName) {
        return;
    }

    const templateFile = path.join(chart.path, "templates", templateName + ".yaml");
    // TODO: check if file already exists

    const templateYaml = yaml.safeDump(template);  // the parse-dump cycle can change the indentation of collections - is this an issue?
    const templateText = fixYamlValueQuoting(templateYaml);
    context.fs.writeFileSync(templateFile, templateText);

    await context.host.showDocument(vscode.Uri.file(templateFile));
}

enum QuoteMode {
    None,
    Double,
}

const NAME_EXPRESSION = '{{ template "fullname" . }}';
const CHART_LABEL_EXPRESSION = '{{ .Chart.Name }}-{{ .Chart.Version | replace "+" "_" }}';

const QUOTE_CONTROL_INFO = [
    { text: NAME_EXPRESSION, mode: QuoteMode.None },
    { text: CHART_LABEL_EXPRESSION, mode: QuoteMode.Double },
];

function templatise(template: any): void {
    ensureMetadata(template);
    cleanseMetadata(template.metadata);

    template.metadata.name = NAME_EXPRESSION;
    template.metadata.labels.chart = CHART_LABEL_EXPRESSION;

    delete template.status;
}

function ensureMetadata(template: any): void {
    template.metadata = template.metadata || {};
    template.metadata.labels = template.metadata.labels || {};
}

const ANNOTATIONS_TO_STRIP = [
    'kubectl.kubernetes.io/last-applied-configuration'
];

function cleanseMetadata(metadata: any): void {
    delete metadata.clusterName;
    delete metadata.creationTimestamp;
    delete metadata.deletionTimestamp;
    delete metadata.generation;
    delete metadata.generateName;
    delete metadata.namespace;
    delete metadata.resourceVersion;
    delete metadata.selfLink;
    delete metadata.uid;

    if (metadata.annotations) {
        for (const annotation of ANNOTATIONS_TO_STRIP) {
            delete metadata.annotations[annotation];
        }
    }
}

function chartsInProject(context: Context): Chart[] {
    const fs = context.fs;
    return subdirectories(fs, context.projectPath)
             .filter((d) => fs.existsSync(path.join(d, "Chart.yaml")))
             .map((d) => ({ name: path.basename(d), path: d }));
}

function subdirectories(fs: FS, directory: string): string[] {
    const immediate = fs.dirSync(directory)
                        .map((e) => path.join(directory, e))
                        .filter((e) => fs.statSync(e).isDirectory());
    const indirect = immediate.map((d) => subdirectories(fs, d));
    return immediate.concat(...indirect);
}

async function pickOrCreateChart(context: Context): Promise<Chart | undefined> {
    // TODO: refactor helmexec.pickChart so we can leverage it here
    const charts = chartsInProject(context);
    switch (charts.length) {
        case 0:
            return await createChart(context);
        case 1:
            return charts[0];
        default:
            const chartPicks = charts.map((c) => ({ label: c.name, chart: c }));
            const pick = await context.host.showQuickPick(chartPicks, { placeHolder: 'Select chart to add the new template to'  });
            return pick ? pick.chart : undefined;
    }
}

function fixYamlValueQuoting(yamlText: string): string {
    let text = yamlText;
    for (const expr of QUOTE_CONTROL_INFO) {
        const q = expr.mode === QuoteMode.Double ? '"' : '';
        text = text.replace(`'${expr.text}'`, `${q}${expr.text}${q}`);
    }
    return text;
}

async function createChart(context: Context): Promise<Chart | undefined> {
    const createResult = await helmCreateCore("No chart found. Enter name of the chart to create.", "mychart");

    if (!createResult) {
        return undefined;
    }

    if (failed(createResult)) {
        context.host.showErrorMessage(createResult.error[0]);
        return undefined;
    }

    return createResult.result;
}

export interface ValueInsertion {
    readonly document: vscode.TextDocument;
    readonly keyPath: string[];
    readonly edit: vscode.TextEdit;
}

export interface TextEdit {
    readonly document: vscode.TextDocument;
    readonly edits: vscode.TextEdit[];
}

export async function convertToParameter(fs: FS, host: Host, document: vscode.TextDocument, selection: vscode.Selection): Promise<Errorable<ValueInsertion>> {
    const helmSymbols = await getHelmSymbols(document);
    if (helmSymbols.length === 0) {
        return { succeeded: false, error: ['Active document is not a Helm template'] };
    }

    const property = symbolAt(selection.anchor, helmSymbols);
    if (!property || property.kind !== vscode.SymbolKind.Constant) {
        return { succeeded: false, error: ['Selection is not a YAML field'] };
    }

    const templateName = path.parse(document.fileName).name;

    const valueLocation = property.location.range;
    const valueText = document.getText(valueLocation);
    const valueSymbolContainmentChain = containmentChain(property, helmSymbols);

    if (valueSymbolContainmentChain.length === 0) {
        return { succeeded: false, error: ['Cannot locate property name'] };
    }

    const rawKeyPath = [templateName, valueSymbolContainmentChain[0].name];
    const keyPath = rawKeyPath.map(sanitiseForGoTemplate);

    const insertParamEdit = await addEntryToValuesFile(fs, host, document, keyPath, valueText);
    if (failed(insertParamEdit)) {
        return { succeeded: false, error: insertParamEdit.error };
    }

    const keyReference = keyPath.join('.');
    const replaceValueWithParamRef = new vscode.TextEdit(valueLocation, `{{ .Values.${keyReference} }}`);

    const appliedEdits = await applyEdits(
        { document: document, edits: [replaceValueWithParamRef] },
        { document: insertParamEdit.result.document, edits: [insertParamEdit.result.edit] }
    );
    if (!appliedEdits) {
        return { succeeded: false, error: ['Unable to update the template and/or values file'] };
    }

    return { succeeded: true, result: insertParamEdit.result };
}

async function applyEdits(...edits: TextEdit[]): Promise<boolean> {
    const wsEdit = new vscode.WorkspaceEdit();
    for (const e of edits) {
        wsEdit.set(e.document.uri, e.edits);
    }
    return await vscode.workspace.applyEdit(wsEdit);
}

async function getHelmSymbols(document: vscode.TextDocument): Promise<vscode.SymbolInformation[]> {
    const symbolProvider = new HelmDocumentSymbolProvider();
    const symbols = await symbolProvider.provideDocumentSymbolsImpl(document, cancellation.dummyToken());
    return symbols;
}

async function addEntryToValuesFile(fs: FS, host: Host, template: vscode.TextDocument, keyPath: string[], value: string): Promise<Errorable<ValueInsertion>> {
    const valuesYamlPath = path.normalize(path.join(path.dirname(template.fileName), '..', 'values.yaml'));
    if (!fs.existsSync(valuesYamlPath)) {
        fs.writeFileSync(valuesYamlPath, '');
    }

    const valuesYamlDoc = await host.readDocument(vscode.Uri.file(valuesYamlPath));
    const valuesYamlAst = await getHelmSymbols(valuesYamlDoc);

    const whatWeHave = findCreatableKeyPath(keyPath, valuesYamlAst);
    const insertion = addToYaml(valuesYamlDoc, valuesYamlAst, whatWeHave.found, whatWeHave.remaining, value);
    return { succeeded: true, result: insertion };
}

function findCreatableKeyPath(keyPath: string[], ast: vscode.SymbolInformation[]): FoundKeyPath {
    const foundPath = findKeyPath(keyPath, ast);
    if (foundPath.remaining.length > 0) {
        return foundPath;
    }

    const disambiguatingPath = disambiguateKeyPath(keyPath);
    const foundDisambiguatingPath = findKeyPath(disambiguatingPath, ast);
    if (foundDisambiguatingPath.remaining.length > 0) {
        return foundDisambiguatingPath;
    }

    return findCreatableKeyPathBySuffixing(keyPath, ast, 1);
}

function disambiguateKeyPath(keyPath: string[]): string[] {
    const path = keyPath.slice(0, keyPath.length - 1);
    const disambiguatedFinal = keyPath.join('_');
    path.push(disambiguatedFinal);
    return path;
}

function findCreatableKeyPathBySuffixing(keyPath: string[], ast: vscode.SymbolInformation[], suffix: number): FoundKeyPath {
    const path = keyPath.slice(0, keyPath.length - 1);
    const suffixedFinal = keyPath[keyPath.length - 1] + suffix.toString();
    path.push(suffixedFinal);

    const foundPath = findKeyPath(path, ast);
    if (foundPath.remaining.length > 0) {
        return foundPath;
    }

    return findCreatableKeyPathBySuffixing(keyPath, ast, suffix + 1);
}

function addToYaml(document: vscode.TextDocument, ast: vscode.SymbolInformation[], parent: vscode.SymbolInformation | undefined, keys: string[], value: string): ValueInsertion {
    const eol = document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';
    if (parent) {
        // TODO: do we need to handle the possibility of a parent node without any child nodes?
        const before = firstChild(document, parent, ast);
        return insertBefore(document, before, keys, value, eol);
    } else {
        // TODO: handle the case where the document is entirely empty
        const before = firstChild(document, undefined, ast);
        return insertBefore(document, before, keys, value, eol);
    }
}

function firstChild(document: vscode.TextDocument, parent: vscode.SymbolInformation | undefined, ast: vscode.SymbolInformation[]): vscode.SymbolInformation | undefined {
    const isDescendant = parent ?
        (n: vscode.SymbolInformation) => parent.location.range.contains(n.location.range) :
        (_n: vscode.SymbolInformation) => true;
    const linearPos = (p: vscode.Position) => document.offsetAt(p);

    return _.chain(ast)
            .filter(isDescendant)
            .filter((n) => n !== parent)
            .filter((n) => n.kind === vscode.SymbolKind.Field)
            .orderBy([(n) => linearPos(n.location.range.start), (n) => linearPos(n.location.range.end)])
            .first()
            .value();
}

function insertBefore(document: vscode.TextDocument, element: vscode.SymbolInformation | undefined, keys: string[], value: string, eol: string): ValueInsertion {
    const insertAt = element ? lineStart(element.location.range.start) : document.positionAt(0);
    const indent = indentLevel(element);
    const text = makeTree(indent, keys, value, eol);
    const edit = vscode.TextEdit.insert(insertAt, text);
    return { document: document, keyPath: keys, edit: edit };
}

function lineStart(pos: vscode.Position): vscode.Position {
    return new vscode.Position(pos.line, 0);
}

function indentLevel(element: vscode.SymbolInformation | undefined): number {
    return element ? element.location.range.start.character : 0;
}

function makeTree(indentLevel: number, keys: string[], value: string, eol: string): string {
    if (keys.length < 1) {
        return '';
    }

    const indent = ' '.repeat(indentLevel);
    if (keys.length === 1) {
        return `${indent}${keys[0]}: ${value}${eol}`;
    }

    const subtree = makeTree(indentLevel + 2, keys.slice(1), value, eol);
    return `${indent}${keys[0]}:${eol}${subtree}`;
}

function sanitiseForGoTemplate(s: string): string {
    return s.replace(/-./g, (h) => h.substring(1).toUpperCase());
}
