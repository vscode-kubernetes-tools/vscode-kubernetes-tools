import * as vscode from "vscode";
import { Kubectl } from "./kubectl";

export type Cluster = {
    name: string;
    context: string;
    user: string;
    active: boolean;
};

export type Namespace = {
    name: string;
    active: boolean;
};

async function getKubeconfig(kubectl: Kubectl): Promise<any> {
    const shellResult = await kubectl.invokeAsync("config view -o json");
    if (shellResult.code !== 0) {
        vscode.window.showErrorMessage(shellResult.stderr);
        return null;
    }
    return JSON.parse(shellResult.stdout);
}

export async function getClusters(kubectl: Kubectl): Promise<Cluster[]> {
    const kubectlConfig = await getKubeconfig(kubectl);
    if (!kubectlConfig) {
        return;
    }
    const currentContext = kubectlConfig["current-context"];
    const contexts = kubectlConfig.contexts;
    return contexts.map((c) => {
        return {
            name: c.context.cluster,
            context: c.name,
            user: c.context.user,
            active: c.name === currentContext
        };
    });
}

export async function deleteCluster(kubectl: Kubectl, cluster: Cluster): Promise<boolean> {
    const deleteClusterResult = await kubectl.invokeAsyncWithProgress(`config delete-cluster ${cluster.name}`, "Deleting cluster...");
    if (deleteClusterResult.code !== 0) {
        await vscode.window.showErrorMessage(`Failed to delete the specified cluster ${cluster.name} from the kubeconfig: ${deleteClusterResult.stderr}`);
        return false;
    }

    const deleteUserResult = await kubectl.invokeAsyncWithProgress(`config unset users.${cluster.user}`, "Deleting user...");
    if (deleteUserResult.code !== 0) {
        await vscode.window.showErrorMessage(`Failed to delete user info for cluster ${cluster.name} from the kubeconfig: ${deleteUserResult.stderr}`);
        return false;
    }

    const deleteContextResult = await kubectl.invokeAsyncWithProgress(`config delete-context ${cluster.context}`, "Deleting context...");
    if (deleteContextResult.code !== 0) {
        vscode.window.showErrorMessage(`Failed to delete the specified cluster's context ${cluster.context} from the kubeconfig: ${deleteContextResult.stderr}`);
        return false;
    }

    vscode.window.showInformationMessage(`Successfully delete the associated cluster/context/user for cluster '${cluster.name}' from the kubeconfig.`);
    return true;
}

export async function getNamespaces(kubectl: Kubectl): Promise<Namespace[]> {
    const shellResult = await kubectl.invokeAsync("get namespaces -o json");
    if (shellResult.code !== 0) {
        vscode.window.showErrorMessage(shellResult.stderr);
        return [];
    }
    const nsObj = JSON.parse(shellResult.stdout);
    const cns = await currentNamespace(kubectl);
    return nsObj.items.map((item) => {
        return {
            name: item.metadata.name,
            active: item.metadata.name === cns
        };
    });
}

export async function currentNamespace(kubectl: Kubectl): Promise<string> {
    const kubectlConfig = await getKubeconfig(kubectl);
    if (!kubectlConfig) {
        return "";
    }
    const ctxName = kubectlConfig["current-context"];
    const currentContext = kubectlConfig.contexts.find((ctx) => ctx.name === ctxName);
    if(!currentContext) {
        return "";
    }
    return currentContext.context.namespace || "default";
}

export async function switchNamespace(kubectl: Kubectl, namespace: string): Promise<boolean> {
    const shellResult = await kubectl.invokeAsync("config current-context");
    if (shellResult.code !== 0) {
        vscode.window.showErrorMessage(shellResult.stderr);
        return false;
    }
    const updateResult = await kubectl.invokeAsyncWithProgress(`config set-context ${shellResult.stdout.trim()} --namespace="${namespace}"`,
        "Switching namespace...");
    if (updateResult.code !== 0) {
        vscode.window.showErrorMessage(updateResult.stderr);
        return false;
    }
    return true;
}
