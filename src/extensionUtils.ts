import * as path from "path";
import * as vscode from "vscode";

import { shell, ShellResult } from "./shell";

/**
 * Install a vscode extension programmatically.
 * 
 * @param extensionId the extension id.
 */
export async function installVscodeExtension(extensionId: string): Promise<boolean> {
    const vscodeCliPath = path.join(path.dirname(process.argv0), "bin", "code");
    const shellResult = await shell.exec(`"${vscodeCliPath}" --install-extension ${extensionId}`);
    if (shellResult.code === 0) {
        const answer = await vscode.window.showInformationMessage(`Extension '${extensionId}' was successfully installed. Reload to enable it.`, "Reload Now");
        if (answer === "Reload Now") {
            await vscode.commands.executeCommand("workbench.action.reloadWindow");
            return true;
        }
    }
    return false;
}

export function isNonEmptyArray(value: any[]): boolean {
    if (value && value.length) {
        return true;
    }
    return false;
}