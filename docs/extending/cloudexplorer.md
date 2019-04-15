# Adding Providers to the Cloud Explorer

Cloud Explorer is a way for users to browse the Kubernetes clusters they have created
in their cloud environments, regardless of whether those clusters appear in their
kubeconfig.  Cloud Explorer provides access to _cloud-specific_ behaviour and features whereas
Cluster Explorer provides access to Kubernetes cluster contents and features.

Out of the box, the Cloud Explorer doesn't know about _any_ clouds.  As a cloud vendor, you
can add your cloud to the Cloud Explorer using the Kubernetes extension's API, by writing
and registering an object called a _cloud provider_.

Note that as with cluster providers, a cloud provider is _not_ needed to use a Kubernetes
cluster that runs in the cloud.  As long as the cluster is in kubeconfig, the extension will work with it.
Cloud providers are used only to surface what is in the user's cloud and to provide
integrated UI for adding clusters to kubeconfig or other tasks that require cloud-specific
support.

## Elements of a cloud provider

An object that provides content for the Cloud Explorer is called a _cloud provider_.  Cloud
providers must be hosted within a Visual Studio Code extension.  This table summarises what
your cloud providers and their hosting extension need to do; the rest of this article goes into detail.

| Component            | Responsibilities                                                     |
|----------------------|----------------------------------------------------------------------|
| Your extension       | Activate when Cloud Explorer is displayed                            |
|                      | Register cloud providers with Kubernetes extension                   |
| Cloud provider       | Implement the cloud provider interface                               |
|                      | Provide metadata for the Cloud Explorer top level                    |
|                      | Display cloud resources in tree format                               |
|                      | Optionally, provide cluster kubeconfig when requested                |
| Kubernetes extension | Display the Cloud Explorer tree                                      |
|                      | Implement standard Merge Into Kubeconfig and Save Kubeconfig commands|

## Implementing the cloud provider

A cloud provider must implement the following interface.  (For documentation purposes
the interface is written in TypeScript terms but any JavaScript object that provides
the specified properties and methods will do.)

```javascript
interface CloudProvider {
    readonly cloudName: string;
    readonly treeDataProvider: vscode.TreeDataProvider<any>;
    getKubeconfigYaml(cluster: any): Promise<string | undefined>;
}
```

### Implementing the metadata

The `cloudName` should be a user-friendly name for your cloud type, such as `Microsoft Azure` or
`Contoso Compute Megafloof`.  It is displayed as a top level node in Cloud Explorer.

### Implementing the tree provider

Your provider completely controls the part of the tree under the top level node provided for it
by the Kubernetes extension.  You define this by implementing the standard `vscode.TreeDataProvider`
interface.  The Kubernetes extension will call into your TreeDataProvider to populate
your branch of the tree; you do _not_ need to register it as associated with a view.

Note that when `getChildren` is called for your first-level tree nodes, the parent `element`
argument will be `undefined` as for a normal TreeDataProvider, _even though there is actually
a parent node_ (provided by the Kubernetes extension).

### Commands for your tree nodes

The Kubernetes extension provides standard implementations for the `Merge into Kubeconfig` and
`Save Kubeconfig` commands.  To opt into these, include the string `kubernetes.providesKubeconfig`
in your tree item context (use the constant `SHOW_KUBECONFIG_COMMANDS_CONTEXT` from the NPM package).
Here is an example from a Microsoft Azure sample provider, which uses a `nodeType` field to
identify which tree nodes represent clusters:

```javascript
getTreeItem(element: AzureTreeNode): vscode.TreeItem | Thenable<vscode.TreeItem> {
    if (element.nodeType === 'cluster') {
        const treeItem = new vscode.TreeItem(element.name, vscode.TreeItemCollapsibleState.None);
        treeItem.contextValue = `aks.cluster ${k8s.CloudExplorerV1.SHOW_KUBECONFIG_COMMANDS_CONTEXT}`;
        return treeItem;
    } else {
        // handle other nodes types
    }
}
```

If you do this, then when the user invokes one of the standard commands for a cluster, the
Kubernetes extension will call the cloud provider's `getKubeconfigYaml` method, passing the tree
data item for which the command was invoked.  Your implementation should handle any user
interaction or any error reporting, and return a string containing the cluster's kubeconfig
in YAML format, or `undefined` to cancel the command (e.g. if there was an error or the user
cancelled out of a prompt).  For example:

```javascript
async function getKubeconfigYaml(cluster: AzureClusterTreeNode): Promise<string | undefined> {
    // Pull out of the tree node the data we need to talk to the cloud
    const { resourceGroupName, name } = parseResource(cluster.armId);
    if (!resourceGroupName || !name) {
        vscode.window.showErrorMessage(`Invalid Azure resource ID ${target.armId}`);
        return undefined;
    }

    try {
        // Interact with the cloud to get the kubeconfig YAML - this is specific to the Azure sample
        const client = new ContainerServiceClient(target.session.credentials, target.subscription.subscriptionId!);
        const accessProfile = await client.managedClusters.getAccessProfile(resourceGroupName, name, 'clusterUser');
        const kubeconfig = accessProfile.kubeConfig!.toString();
        return kubeconfig;
    } catch (e) {
        vscode.window.showErrorMessage(`Can't get kubeconfig: ${e}`);
        return undefined;
    }
}
```

_TODO: check and document behaviour if users define their own commands on their tree nodes (because we wrap them)_

## Registering the cloud provider

In order to be displayed in Cloud Explorer, a cloud
provider must be _registered_ with the Kubernetes extension.  This is the responsibility
of the VS Code extension that hosts the cloud provider.  To do this, the extension must:

* Activate in response to the `kubernetes.cloudExplorer` view
* Request the Kubernetes extension's Cloud Provider API
* Call the `register` method for each cloud provider it wants to display

### Activating the cloud provider extension

Your extension needs to activate in response to the `kubernetes.cloudExplorer`
commands, so that it can register its cloud provider(s) before the tree is
displayed.  To do this, your `package.json` must include the following activation event:

```json
    "activationEvents": [
        "onView:kubernetes.cloudExplorer"
    ],
```

Depending on your extension you may have other activation events as well.

### Registering cloud providers with the Kubernetes extension

In your extension's `activate` function, you must register your provider(s) using the
Kubernetes extension API.  The following sample shows how to do this using the NPM
helper package; if you don't use the helper then the process of requesting the API is
more manual but the registration is the same.

```javascript
const MY_PROVIDER = {
    cloudName: "Contoso Compute Megafloof",
    treeDataProvider: new MegafloofTreeDataProvider(),
    getKubeconfigYaml: (c: ClusterNode) => getClusterKubeconfig(c)
};

export async function activate(context: vscode.ExtensionContext) {
    const cloudExplorer = await k8s.extension.cloudExplorer.v1;

    if (!cloudExplorer.available) {
        console.log("Unable to register provider: " + cp.reason);
        return;
    }

    cloudExplorer.api.registerCloudProvider(MY_PROVIDER);
}
```

Your cluster provider is now ready for testing!


