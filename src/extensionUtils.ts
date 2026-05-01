import * as vscode from "vscode";

/**
 * Install a vscode extension programmatically.
 *
 * @param extensionId the extension id.
 */
export async function installVscodeExtension(extensionId: string): Promise<boolean> {
    try {
        await vscode.commands.executeCommand("workbench.extensions.installExtension", extensionId);
    } catch (err) {
        vscode.window.showErrorMessage(`Failed to install extension '${extensionId}': ${err}`);
        return false;
    }
    const installed = await waitForExtension(extensionId);
    if (!installed) {
        vscode.window.showErrorMessage(`Extension '${extensionId}' was not available after installation.`);
        return false;
    }
    const answer = await vscode.window.showInformationMessage(`Extension '${extensionId}' was successfully installed. Reload to enable it.`, "Reload Now");
    if (answer === "Reload Now") {
        await vscode.commands.executeCommand("workbench.action.reloadWindow");
        return true;
    }
    return false;
}

export async function waitForExtension(extensionId: string): Promise<boolean> {
    return new Promise((resolve) => {
        const interval = setInterval(() => {
            const extension = vscode.extensions.getExtension(extensionId);
            if (extension) {
                clearInterval(interval);
                resolve(true);
            }
        }, 1000);

        setTimeout(() => {
            clearInterval(interval);
            resolve(false);
        }, 60000); // Wait for up to 60 seconds
    });
}

export function isNonEmptyArray(value: any[]): boolean {
    if (value && value.length) {
        return true;
    }
    return false;
}