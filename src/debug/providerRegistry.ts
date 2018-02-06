import * as vscode from "vscode";

import { IDebugProvider, IDockerParser } from "./debugInterfaces";
import { JavaDebugProvider } from "./javaDebugProvider";
import { JavaDockerResolver } from "./javaDockerResolver";

const supportedProviders: IDebugProvider[] = [
    new JavaDebugProvider(new JavaDockerResolver())
];

async function showProviderPick(): Promise<IDebugProvider> {
    if (supportedProviders.length < 1) {
        return null;
    } else if (supportedProviders.length === 1) {
        return supportedProviders[0];
    }

    const providerItems = supportedProviders.map((provider) => {
        return {
            label: provider.getDebuggerType(),
            provider
        };
    });
    
    const pickedProvider = await vscode.window.showQuickPick(<any[]> providerItems, { placeHolder: "Please select the debug type." });
    if (!pickedProvider) {
        return null;
    }
    return pickedProvider.provider;
}

export async function getDebugProvider(baseImage?: string): Promise<IDebugProvider> {
    let debugProvider = null;
    if (baseImage) {
        debugProvider = supportedProviders.find((provider) => provider.getDockerResolver().isSupportedImage(baseImage));
    }
    if (!debugProvider) {
        debugProvider = await showProviderPick();
    }
    return debugProvider;
}
