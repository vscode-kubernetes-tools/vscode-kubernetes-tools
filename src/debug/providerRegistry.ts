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

    const pickedProvider = await vscode.window.showQuickPick(providerItems, { placeHolder: "Select the environment" });
    if (!pickedProvider) {
        return undefined;
    }
    return pickedProvider.provider;
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
