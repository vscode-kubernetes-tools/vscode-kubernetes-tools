import { VSCodeAzureSubscriptionProvider } from "@microsoft/vscode-azext-azureauth";
import * as vscode from "vscode";

export class AKSProvider implements CloudProvider {
    private provider = new VSCodeAzureSubscriptionProvider();
    getName(): string {
        return "Azure Kubernetes Service (AKS)";
    }

    async isSignedIn(): Promise<boolean> {
        return this.provider.isSignedIn();
    }

    async signIn(): Promise<boolean> {
        return this.provider.signIn();
    }

    async prerequisites(): Promise<string | undefined> {
        const subscriptions = await this.provider.getSubscriptions();
        if (!subscriptions || subscriptions.length === 0) {
            vscode.window.showErrorMessage(`Failed to get subscriptions for ${this.getName()}`);
            return;
        }

        const selectedSubscription = await vscode.window.showQuickPick(
            subscriptions.map((subscription) => subscription.name),
            { placeHolder: "Select the subscription" }
        );

        if (!selectedSubscription) {
            vscode.window.showErrorMessage(`Failed to get subscriptions for ${this.getName()}`);
            return;
        }
        return subscriptions.find((sub) => sub.name === selectedSubscription)?.subscriptionId;
    }

    async createCluster(inputs: any): Promise<void> {
        const aksExtensionId = "ms-kubernetes-tools.vscode-aks-tools";
        const aksExtension = vscode.extensions.getExtension(aksExtensionId);
        if (!aksExtension) {
            // Prompt the user to install the extension
            const install = await vscode.window.showInformationMessage(
                "The Azure Kubernetes Service extension is required to create a cluster. Do you want to install it?",
                "Install",
                "Cancel"
            );
            if (install === "Install") {
                // install extension
                await vscode.commands.executeCommand('workbench.extensions.installExtension', 'ms-kubernetes-tools.vscode-aks-tools');
                // Wait for the user to install the extension
                const extensionInstalled = await waitForExtension(aksExtensionId);
                if (extensionInstalled) {
                    // Execute the command from the installed extension
                    await vscode.commands.executeCommand("aks.createCluster", inputs);

                }
            }
        } else {
            await vscode.commands.executeCommand("aks.createCluster", inputs);
        }
    }
}

async function waitForExtension(extensionId: string): Promise<boolean> {
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