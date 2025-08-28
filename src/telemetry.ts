import { TelemetryReporter } from '@vscode/extension-telemetry';
import vscode = require('vscode');

export let reporter: TelemetryReporter;

export class Reporter extends vscode.Disposable {

    constructor(ctx: vscode.ExtensionContext) {
        super(() => { if (reporter) { reporter.dispose(); } });
        const packageInfo = getPackageInfo(ctx);
        if (packageInfo) {
            reporter = new TelemetryReporter(packageInfo.aiKey);
        }
    }
}

interface IPackageInfo {
    name: string;
    version: string;
    aiKey: string;
}

function getPackageInfo(_context: vscode.ExtensionContext): IPackageInfo | undefined {
    const extensionPackage = require('../package');
    if (extensionPackage) {
        return {
            name: extensionPackage.name,
            version: extensionPackage.version,
            aiKey: extensionPackage.aiKey
        };
    }
    return undefined;
}
