import { VSCodeAzureSubscriptionProvider } from "@microsoft/vscode-azext-azureauth";
import * as vscode from "vscode";
import { longRunning } from "../../utils/notification";
import { TokenCredential } from "@azure/core-auth";
import { ContainerServiceClient } from "@azure/arm-containerservice";

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
        const subscriptions = await longRunning("Getting Azure subscriptions", async () => {
            return await this.provider.getSubscriptions();
        });
        
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

    // retrieves the list of AKS clusters in the given subscription
    async listClusters(subscriptionId: string): Promise<{ name: string; resourceGroup: string; }[] | undefined> {
        // getting active session
        const session = await vscode.authentication.getSession(
            "microsoft",
            ["https://management.azure.com/.default"],
            { createIfNone: true }
        );
        if (!session) {
            vscode.window.showErrorMessage("You must be signed into Azure to list clusters.");
            return;
        }

        const token = session.accessToken;

        // The logic below does the same thing as the ResourceGraphClient, but we are using 
        // the REST API directly to avoid bundling issues we currently have.
        // After we undergo major updates 
        // to address our outdated/broken dependencies, we can revisit this.

        const url = "https://management.azure.com/providers/Microsoft.ResourceGraph/resources?api-version=2021-03-01";
        const body = {
            subscriptions: [subscriptionId],
            query: "Resources | where type =~ 'Microsoft.ContainerService/managedClusters' | project name, resourceGroup"
        };

        let resp;
        try {
            // using fetch to call the Resource Graph API
            resp = await fetch(url, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
            });
        } catch (e: any) {
            vscode.window.showErrorMessage(`Network error querying Resource Graph: ${e.message}`);
            return;
        }
    
        if (!resp.ok) {
            vscode.window.showErrorMessage(`Resource Graph failed: ${resp.status} ${resp.statusText}`);
            return;
        }

        // parsing the response
        let json: any;
        try {
            json = await resp.json();
        } catch (e: any) {
            vscode.window.showErrorMessage(`Invalid JSON from Resource Graph: ${e.message}`);
            return;
        }
    
        return (json.data as any[]).map((c) => ({
            name: c.name,
            resourceGroup: c.resourceGroup
        }));
    }

    // retrieves the credentials for the given cluster
    async getCredentials(){
        const session = await vscode.authentication.getSession(
            "microsoft",
            ["https://management.azure.com/.default"],
            { createIfNone: true }
        );
        if (!session) {
            vscode.window.showErrorMessage("You must be signed into Azure to list clusters.");
            return;
        }
        return {
            getToken: async () => ({
                token: session.accessToken,
                expiresOnTimestamp: 0,
            }),
        } as TokenCredential;
    }
    // gets kubeconfig yaml for the given cluster
    async getKubeconfigYaml(
        subscriptionId: string,
        resourceGroup: string,
        clusterName: string
    ): Promise<string | undefined> {
        const credential = await this.getCredentials();
        if (!credential) {
            vscode.window.showErrorMessage("Failed to get credentials for AKS.");
            return;
        }
        const client = new ContainerServiceClient(credential, subscriptionId);
        try {
            // Using the ContainerServiceClient to get the kubeconfig
            const result = await client.managedClusters.listClusterUserCredentials(resourceGroup, clusterName);
            const kubeconfigBase64 = result.kubeconfigs?.[0]?.value;
        if (!kubeconfigBase64) {
            vscode.window.showErrorMessage("Failed to retrieve kubeconfig from AKS.");
            return;
        }
        // Convert the base64 string to a usable UTF-8 string
        const kubeconfigYaml = Buffer.from(kubeconfigBase64).toString("utf8");
        return kubeconfigYaml;
        } catch (err) {
            vscode.window.showErrorMessage(`Error fetching kubeconfig: ${(err as any).message || String(err)}`);
            return;
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