
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Kubectl } from '../../kubectl';

const RECOMMENDED_EXT_CONTEXT = 'kubernetes:recommendedExtensions';

enum VSCodeCommands {
    SetContext = 'setContext',
    Open = 'vscode.open'
}

interface RecommendedExtension {
    id: string;
    label: string;
    description: string;
    icon: string;
}
interface Recommendations {
    crdApiToExtensions: { [crdApi: string]: string[] };
    extensions: RecommendedExtension[];
}

class ExtensionTreeItem extends vscode.TreeItem {

    constructor(private ext: RecommendedExtension) {
        super(ext.label, vscode.TreeItemCollapsibleState.None);
    }

    get description(): string {
        return this.ext.description;
    }

    get iconPath(): vscode.Uri {
        return vscode.Uri.parse(this.ext.icon);
    }

    get command(): vscode.Command {
        return { command: VSCodeCommands.Open, arguments: [vscode.Uri.parse(`vscode:extension/${this.ext.id}`)] } as vscode.Command;
    }

}

class RecommendedExtensionsView implements vscode.TreeDataProvider<RecommendedExtension>{

    private extensions: RecommendedExtension[] | undefined;
    private treeView: vscode.TreeView<RecommendedExtension>;
    private onDidChangeTreeDataEmitter = new vscode.EventEmitter<RecommendedExtension | undefined>();
    readonly onDidChangeTreeData: vscode.Event<RecommendedExtension | undefined> = this.onDidChangeTreeDataEmitter.event;

    constructor() {
        this.treeView = vscode.window.createTreeView('kubernetes.RecommendedExtensions', { treeDataProvider: this });
    }

    dispose(): void {
        this.treeView.dispose();
    }

    getTreeItem(element: RecommendedExtension): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return new ExtensionTreeItem(element);
    }
    getChildren(element?: RecommendedExtension): vscode.ProviderResult<RecommendedExtension[]> {
        if (!element && this.extensions) {
            return this.extensions;
        }
        return undefined;
    }
    getParent?(): vscode.ProviderResult<RecommendedExtension> {
        return undefined; // we have plain list, so no parents
    }

    setExtensions(extensions: RecommendedExtension[]): void {
        this.extensions = extensions;
    }

}

async function recommendExtensionsToUser(extensions: RecommendedExtension[], subscription: vscode.Disposable[]): Promise<void> {
    if (extensions.length > 0) { // do not prompt if we cannot recommend anything
        const treeView = new RecommendedExtensionsView();
        subscription.push(treeView);
        treeView.setExtensions(extensions);
        vscode.commands.executeCommand(VSCodeCommands.SetContext, RECOMMENDED_EXT_CONTEXT, true);
    }

}

async function getCRDApiGroups(kubectl: Kubectl): Promise<string[]> {
    const result = new Set<string>();
    const invokeResult = await kubectl.invokeCommand('get crd -o json');
    if (invokeResult.resultKind === 'exec-succeeded') {
        try {
            const res = JSON.parse(invokeResult.stdout);
            res.items.forEach((i: any) => result.add(i.spec.group));
        } catch (err) {
            // ignore
        }
    }
    return Array.from(result);
}

async function readRecommendation(extPath: string): Promise<Recommendations> {
    return new Promise((resolve, reject) => {
        fs.readFile(path.join(extPath, 'recommendation', 'recommended-extensions.json'), (err, content) => {
            if (err) {
                reject(err);
            }
            const fileContent = content.toString('utf8');
            try {
                resolve(JSON.parse(fileContent));
            } catch (error) {
                reject(error);
            }
        });
    });
}

export async function recommendExtensions(kubectl: Kubectl, context: vscode.ExtensionContext): Promise<void> {
    vscode.commands.executeCommand(VSCodeCommands.SetContext, RECOMMENDED_EXT_CONTEXT, false);
    const crdApiGroups = await getCRDApiGroups(kubectl);

    const extensionToPromote = new Set<string>();
    const recommendation = await readRecommendation(context.extensionPath);
    const recommendationsMap = recommendation.crdApiToExtensions;
    // collect extension id to promote based on installed operators
    for (const crdApi of crdApiGroups) {
        for (const key in recommendationsMap) {
            if (recommendationsMap.hasOwnProperty(key)) {
                const value = recommendationsMap[key];
                if (crdApi.startsWith(key)) {
                    value.forEach((val: string) => extensionToPromote.add(val));
                }
            }
        }
    }

    // remove already installed extensions
    if (extensionToPromote.size > 0) {
        for (const ext of vscode.extensions.all) {
            if (extensionToPromote.has(ext.id)) {
                extensionToPromote.delete(ext.id);
            }
        }
    }

    // get needed extensions description from json
    const extDescription: RecommendedExtension[] = [];
    recommendation.extensions.forEach((ext) => {
        if (extensionToPromote.has(ext.id)) {
            extDescription.push(ext);
        }
    });

    recommendExtensionsToUser(extDescription, context.subscriptions);
}
