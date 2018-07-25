import * as vscode from 'vscode';
import * as path from 'path';
import { FS } from './fs';
import { Host } from './host';

interface Context {
    readonly fs: FS;
    readonly host: Host;
    readonly projectPath: string;
}

export function convertToTemplate(fs: FS, host: Host, projectPath: string, uri: vscode.Uri | undefined): void {
    const context = { fs, host, projectPath };
    const activeDocument = host.activeDocument();
    if (uri) {
        // it's a file explorer click
        addChartFrom(context, uri.fsPath);
    } else if (activeDocument) {
        addChart(context, activeDocument.getText());
    } else {
        host.showErrorMessage("This command requires a YAML file open or selected in the Explorer.");
    }
}

// What it needs to do:
// * How many charts already exist in this project?  (A chart is a diorectory containing
//   a Chart.yaml file.)
//   - None - we need to helm create one.  (But this will create scaffolding - do we want that?)
//   - One - we need to add the template to that chart.
//   - Several - we need to prompt for which chart to add it to.
// * Then we create a file in chart_dir/templates
//   - Do we need to create anything in chart_dir/charts?  (No - this is for dependent charts.)
// * Copy the resource/active doc YAML to the new file
// * Strip out output-only stuff such as status
// * Paramterise anything we can reliably parameterise
//   - Change it to a values.* (or something-else.*?) reference
//   - Add the * to values.yaml if required
// * Add Helm boilerplate such as chart: labels

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
    context.host.showInformationMessage(`create for ${resourceYaml.substring(0, 80)} in ${chart}`);
}

function chartsInProject(context: Context): string[] {
    const fs = context.fs;
    return subdirectories(fs, context.projectPath)
             .filter((d) => fs.existsSync(path.join(d, "Chart.yaml")))
             .map((d) => path.basename(d));
}

function subdirectories(fs: FS, directory: string): string[] {
    const immediate = fs.dirSync(directory)
                        .map((e) => path.join(directory, e))
                        .filter((e) => fs.statSync(e).isDirectory());
    const indirect = immediate.map((d) => subdirectories(fs, d));
    return immediate.concat(...indirect);
}

async function pickOrCreateChart(context: Context): Promise<string | undefined> {
    // TODO: refactor helmexec.pickChart so we can leverage it here
    const charts = chartsInProject(context);
    switch (charts.length) {
        case 0:
            // for now.  Sad!
            context.host.showErrorMessage("No charts found.");
            return undefined;
        case 1:
            return charts[0];
        default:
            return await context.host.showQuickPick(charts, { placeHolder: 'Select chart to add the new template to'  });
    }
}
