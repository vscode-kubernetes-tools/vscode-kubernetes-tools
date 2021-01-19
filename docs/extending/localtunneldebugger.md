# Adding Providers to the Local Tunnel Debugger

The Local Tunnel Debugger is intended to provide a local debugging option that includes
the benefits of remote debugging. Traffic from the cluster is rerouted to the version of the application 
running locally, so that developers can run and debug their code while freely communicating
with resources in the cluster.

Local Tunnel Debug providers can be installed via the marketplace. Developers of extensions with 
tunnel debugging capabilities can register themselves as a Local Tunnel Debug provider in order
to hook into the Kubernetes extension's API.

## Elements of a debug provider

An object that provides content for the Local Tunnel Debugger is called a _local tunnel debug provider_.
Providers must be hosted within a Visual Studio Code extension.  This table summarises what
your providers and their hosting extension need to do; the rest of this article goes into detail.

| Component            | Responsibilities                                                     |
|----------------------|----------------------------------------------------------------------|
| Your extension       | <ul><li>Activate when the Cluster Explorer is displayed or when the Debug (Local Tunnel) option is selected in the command palette</li><li>Register debug providers with Kubernetes extension</li><li>Tag itself as a local tunnel debug provider in the Visual Studio Marketplace</li></ul>        |
| Local Tunnel Debug Provider| <ul><li>Implement the local tunnel debug provider interface</li><li>Resolve the command target</li><li>Gather choices from the user in order to generate or select the debug configuration to use</li><li>Start a Local Tunnel debugging session in response to the Debug (Local Tunnel) command</li></ul>  |
| Kubernetes extension | <ul><li>Display the Debug (Local Tunnel) command in the palette or when interacting with supported resources in the Cluster Explorer</li><li>Allow users to configure which debug provider to use</li></ul>                               |                              |

## Implementing the local tunnel debug provider

A local tunnel debug provider must implement the following interface.  (For documentation purposes
the interface is written in TypeScript terms but any JavaScript object that provides
the specified properties and methods will do.)

```javascript
interface LocalTunnelDebugProvider {
    readonly id: string;
    startDebugging(target?: any): void;
}
```

### Implementing the metadata

The `id` should be a user-friendly name for your debug provider, such as `Contoso Trampoline Debugger`.  
The `id` will allow users to configure a default local tunnel debugger to use by setting the `vs-kubernetes.local-tunnel-debug-provider` field under `vs-kubernetes` in settings.json.

### Implementing the debugger

Your provider's implementation of `startDebugging(target?: any)` is responsible for resolving the debug target (such as a pod or service) and starting the debug session. You can use the cluster explorer API to resolve the target (see [commandtargets.md](commandtargets.md) for more info). An example implementation is given below:

```javascript
const MY_PROVIDER = {
    id: "Contoso Trampoline Debugger",
    startDebugging: (target?: any) => startDebugSession(target)
};

function startDebugSession(target?: any) {
    const clusterExplorer = await k8s.extension.clusterExplorer.v1;
    const commandTarget = clusterExplorer.resolveCommandTarget(target);

    if (commandTarget) {
        if (commandTarget.nodeType === 'resource') {
            if (commandTarget.resourceKind.manifestKind === 'Pod') {

                // Custom logic for selecting or generating the Local Tunnel debug configuration goes here
                const configToUse: string | vscode.DebugConfiguration = this.resolveLocalTunnelDebugConfigurationForPod(commandTarget);

                // Start the debug session
                vscode.debug.startDebugging(folder, configToUse);
            }
        }
    } else {
        // The user selected the Debug (Local Tunnel) command from the command palette or from
        // somewhere else that you were displaying it.
    }
}
```

## Registering the debug provider

In order to hook into the Debug (Local Tunnel) option, a local debug provider must be _registered_
with the Kubernetes extension. This is the responsibility of the VS Code extension that hosts
the debug provider. To do this, the extension must:

* Activate in response to the `kubernetes.cloudExplorer` view
* Activate in response to the `Debug (Local Tunnel)` command
* Request the Kubernetes extension's Local Tunnel Debug Provider API
* Call the `register` method for each cloud provider it wants to display

### Activating the debug provider extension

Your extension needs to activate in response to the cluster explorer and command palette
commands, so that it can register as a debug provider before the debug session is started.
To do this, your `package.json` must include the following activation events:

```json
    "activationEvents": [
        "onView:extension.vsKubernetesExplorer",
        "onCommand:extension.vsKubernetesDebugLocalTunnel",
    ],
```

Depending on your extension you may have other activation events as well.

### Registering local tunnel debug providers with the Kubernetes extension

In your extension's `activate` function, you must register your provider(s) using the
Kubernetes extension API.  The following sample shows how to do this using the NPM
helper package; if you don't use the helper then the process of requesting the API is
more manual but the registration is the same.

```javascript
const MY_PROVIDER = {
    id: "Contoso Trampoline Debugger",
    startDebugging: (target?: any) => startDebugSession(target)
};

export async function activate(context: vscode.ExtensionContext) {
    const localTunnelDebugger = await k8s.extension.localTunnelDebugger.v1;

    if (!localTunnelDebugger.available) {
        console.log("Unable to register provider: " + localTunnelDebugger.reason);
        return;
    }

    localTunnelDebugger.api.registerLocalTunnelDebugProvider(MY_PROVIDER);
}
```

Your debug provider is now ready for testing!

## Tagging your debug provider extension

The Local Tunnel Debugger has a link for users to find providers on the Visual Studio
Marketplace.  If you'd like to appear in this link, please tag your extension
with the keyword `kubernetes-extension-local-tunnel-debug-provider` in `package.json`.
For example:

```json
{
    "keywords": [
        "kubernetes",
        "contoso",
        "megafloof",
        "kubernetes-extension-local-tunnel-debug-provider"
    ]
}
```
