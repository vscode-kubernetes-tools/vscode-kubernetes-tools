import * as vscode from "vscode";

import { IDebugProvider } from "./debugProvider";
import { DotNetDebugProvider } from "./dotNetDebugProvider";
import { JavaDebugProvider } from "./javaDebugProvider";
import { NodejsDebugProvider } from "./nodejsDebugProvider";
import { PythonDebugProvider } from "./pythonDebugProvider";
import { ProcessInfo } from "./debugUtils";

const supportedProviders: IDebugProvider[] = [
    new DotNetDebugProvider(),
    new JavaDebugProvider(),
    new NodejsDebugProvider(),
    new PythonDebugProvider()
];

async function showProviderPick(providers: IDebugProvider[]): Promise<IDebugProvider | undefined> {
    const providerItems = providers.map((provider) => {
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

export async function getDebugProvider(baseImage?: string, runningProcesses?: ProcessInfo[]): Promise<IDebugProvider | undefined> {
    let debugProvider = null;
    if (baseImage) {
        debugProvider = supportedProviders.find((provider) => provider.isSupportedImage(baseImage));
    }

    if (!debugProvider)
    {
        let candidateProviders: IDebugProvider[];
        if (runningProcesses) {
            candidateProviders = [] as IDebugProvider[];
            for (const provider of supportedProviders) {
                const filteredProcesses = provider.filterSupportedProcesses(runningProcesses);
                if (!filteredProcesses || filteredProcesses.length > 0) {
                    candidateProviders.push(provider);
                }
            }
        } else {
            candidateProviders = supportedProviders;
        }

        if (candidateProviders.length === 0) {
            // there is only one debugger that qualifies, so use it
            debugProvider = candidateProviders[0];
        } else if (candidateProviders.length > 1) {
            // more than 1 debugger qualifies, so show picker showing candidates
            debugProvider = await showProviderPick(candidateProviders);
        } else {
            throw "No valid debuggers were found for the processes currently running on the container.";
        }
    }

    return debugProvider;
}

export function getSupportedDebuggerTypes(): string[] {
    return supportedProviders.map((provider) => provider.getDebuggerType());
}

export function getDebugProviderOfType(debuggerType: string): IDebugProvider | undefined {
    return supportedProviders.find((debugProvider) => debugProvider.getDebuggerType() === debuggerType);
}
