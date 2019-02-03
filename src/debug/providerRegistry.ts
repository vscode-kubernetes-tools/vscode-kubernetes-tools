import * as vscode from "vscode";

import { IDebugProvider } from "./debugProvider";
import { JavaDebugProvider } from "./javaDebugProvider";
import { NodejsDebugProvider } from "./nodejsDebugProvider";
const supportedProviders: IDebugProvider[] = [
    new JavaDebugProvider(),
    new NodejsDebugProvider()
];

async function showProviderPick(): Promise<IDebugProvider | undefined> {
    const providerItems = supportedProviders.map((provider) => {
        return {
            label: provider.getDebuggerType(),
            description: "",
            provider
        };
    });

<<<<<<< HEAD
    const pickedProvider = await vscode.window.showQuickPick(<vscode.QuickPickItem[]>providerItems, { placeHolder: "Select the environment" });
=======
    const pickedProvider = await vscode.window.showQuickPick(providerItems, { placeHolder: "Select the environment" });
>>>>>>> upstream/master
    if (!pickedProvider) {
        return undefined;
    }
<<<<<<< HEAD
    return (<any>pickedProvider).provider;
=======
    return pickedProvider.provider;
>>>>>>> upstream/master
}

export async function getDebugProvider(baseImage?: string): Promise<IDebugProvider | undefined> {
    let debugProvider = null;
    if (baseImage) {
        debugProvider = supportedProviders.find((provider) => provider.isSupportedImage(baseImage));
    }
    if (!debugProvider) {
        debugProvider = await showProviderPick();
    }
    return debugProvider;
}

export function getSupportedDebuggerTypes(): string[] {
    return supportedProviders.map((provider) => provider.getDebuggerType());
}

export function getDebugProviderOfType(debuggerType: string): IDebugProvider | undefined {
    return supportedProviders.find((debugProvider) => debugProvider.getDebuggerType() === debuggerType);
}
