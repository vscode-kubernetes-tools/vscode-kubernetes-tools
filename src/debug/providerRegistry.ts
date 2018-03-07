import * as vscode from "vscode";

import { IDebugProvider } from "./debugProvider";
import { JavaDebugProvider } from "./javaDebugProvider";

const supportedProviders: IDebugProvider[] = [
    new JavaDebugProvider()
];

async function showProviderPick(): Promise<IDebugProvider> {
    const providerItems = supportedProviders.map((provider) => {
        return {
            label: provider.getDebuggerType(),
            description: "",
            provider
        };
    });
    
    const pickedProvider = await vscode.window.showQuickPick(<vscode.QuickPickItem[]> providerItems, { placeHolder: "Select the environment" });
    if (!pickedProvider) {
        return null;
    }
    return (<any> pickedProvider).provider;
}

export async function getDebugProvider(baseImage?: string): Promise<IDebugProvider> {
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
