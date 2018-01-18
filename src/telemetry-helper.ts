import TelemetryReporter from 'vscode-extension-telemetry';
import { reporter } from './telemetry';

export function telemetrise(command: string, callback: (...args: any[]) => any) : (...args: any[]) => any {
    return (a) => {
        reporter.sendTelemetryEvent("command", { command: command });
        return callback(a);
    };
}
