import { LocalRedirectionDebuggerProvider } from './localredirectiondebugger.extension';

export class LocalRedirectionDebugger /* implements vscode.TreeDataProvider<CloudExplorerTreeNode>*/ {
    private readonly providers = Array.of<LocalRedirectionDebuggerProvider>();

    register(provider: LocalRedirectionDebuggerProvider): void {
        console.log(`You registered local redirection debugger type ${provider.id}`);
        this.providers.push(provider);
    }
}


