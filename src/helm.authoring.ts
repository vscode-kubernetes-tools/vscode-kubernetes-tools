import * as vscode from 'vscode';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { FS } from './fs';
import { Host } from './host';
import { ResourceNode, isKubernetesExplorerResourceNode } from './explorer';
import { helmCreateCore } from './helm.exec';
import { failed, Errorable } from './errorable';
import { symbolAt, containmentChain } from './helm.symbolProvider';

interface Context {
    readonly fs: FS;
    readonly host: Host;
    readonly projectPath: string;
}

interface Chart {
    name: string;
    path: string;
}

export async function convertToTemplate(fs: FS, host: Host, projectPath: string, target: vscode.Uri | ResourceNode | undefined): Promise<void> {
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
    foldSpindleAndMutilate(template);

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
const CHART_LABEL_EXPRESSION = '{{ .Chart.Name }}-{{ .Chart.Version | replace "+" "_" }}}';

const QUOTE_CONTROL_INFO = [
    { text: NAME_EXPRESSION, mode: QuoteMode.None },
    { text: CHART_LABEL_EXPRESSION, mode: QuoteMode.Double },
];

function foldSpindleAndMutilate(template: any): void {
    ensureMetadata(template);
    cleanseMetadata(template.metadata);

    template.metadata.name = NAME_EXPRESSION;
    template.metadata.labels.chart = CHART_LABEL_EXPRESSION;

    // TODO: should we auto parameterise certain fields depending on the kind?
    // E.g. spec.template.metadata.labels.app, is that always meant to be set?
    // (Is there always a spec?)

    delete template.status;
}

function ensureMetadata(template: any): void {
    template.metadata = template.metadata || {};
    template.metadata.labels = template.metadata.labels || {};
}

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
        delete metadata.annotations['kubectl.kubernetes.io/last-applied-configuration'];
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
        return;
    }

    return createResult.result;
}

export async function convertToParameter(document: vscode.TextDocument, selection: vscode.Selection): Promise<Errorable<vscode.TextEdit>> {
    const helmSymbols = await getHelmSymbols(document);
    if (helmSymbols.length === 0) {
        return { succeeded: false, error: ['Active document is not a Helm template'] };
    }

    const property = symbolAt(selection.anchor, helmSymbols);
    if (!property || property.kind !== vscode.SymbolKind.Constant) {
        return { succeeded: false, error: ['Selection is not a YAML field'] };
    }

    // TODO: we probably want to do this only for leaf properties

    const valueLocation = property.location.range;
    const valueText = document.getText(valueLocation);
    const valueSymbolContainmentChain = containmentChain(property, helmSymbols);

    if (valueSymbolContainmentChain.length === 0) {
        return { succeeded: false, error: ['Cannot locate property name'] };
    }

    const valuePath = `service.${valueSymbolContainmentChain[0].name}`;
    const replaceValueWithParamRef = new vscode.TextEdit(valueLocation, ` {{ .Values.${valuePath} }}`);

    await applyEdits(document, /* insertParamEdit, */ replaceValueWithParamRef);

    return { succeeded: true, result: replaceValueWithParamRef /* or better insertParamEdit but we've not done that yet */ };
}

async function applyEdits(document: vscode.TextDocument, ...edits: vscode.TextEdit[]): Promise<boolean> {
    const wsEdit = new vscode.WorkspaceEdit();
    wsEdit.set(document.uri, edits);
    return await vscode.workspace.applyEdit(wsEdit);
}

async function getHelmSymbols(document: vscode.TextDocument): Promise<vscode.SymbolInformation[]> {
    const sis: any = await vscode.commands.executeCommand('vscode.executeDocumentSymbolProvider', document.uri);

    if (sis && sis.length) {
        return sis;
    }

    return [];
}
