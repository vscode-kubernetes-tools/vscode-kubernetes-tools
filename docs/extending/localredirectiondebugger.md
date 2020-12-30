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
|                      | Tag itself as a cloud provider in the Visual Studio Marketplace      |
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

### Supporting standard commands on cloud Kubernetes clusters

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
        const client = new ContainerServiceClient(cluster.session.credentials, cluster.subscription.subscriptionId!);
        const accessProfile = await client.managedClusters.getAccessProfile(resourceGroupName, name, 'clusterUser');
        const kubeconfig = accessProfile.kubeConfig!.toString();
        return kubeconfig;
    } catch (e) {
        vscode.window.showErrorMessage(`Can't get kubeconfig: ${e}`);
        return undefined;
    }
}
```

### Implementing your own commands for cloud resources

Your TreeDataProvider can define contexts on its tree items, enabling you to contribute your
own commands to those items.  For the most part this works in the normal way, using the
`contributes.menus.view/item/context` section of `package.json`, and with the command target
passed to the command handler.  Your tree data provider defines your viewItem contexts in
its `getTreeItem` implementation, just as in a normal tree view.

You can also attach commands to the top-level cloud entries, using a `when` clause with
the viewItem context matching `/kubernetes\.cloudExplorer\.cloud\.`_cloudName_`/i`.  Remember to escape the
backslashes in `package.json`, e.g. `"when": "viewItem =~ /kubernetes\\.cloudExplorer\\.cloud\\.contoso/i`.

To distinguish the built-in and contributed nodes, the Kubernetes extension encapsulates command targets
in Cloud Explorer, and your command handlers must resolve these to determine what resource
the command was invoked on.

To do this, use the `resolveCommandTarget` method of the Cloud Explorer API.  If the command
target is _not_ a Cloud Explorer node, this returns `undefined`.  Otherwise, it returns either:

* For top level (cloud name) nodes, an object with a `nodeType` of `cloud` and a `cloudName`
  of the cloud name.
* For other nodes (those defined by your TreeDataProvider), an object with a `nodeType` of `resource`,
  a `cloudName` of the cloud name and a `cloudResource` property containing the object originally
  returned by your TreeDataProvider.

Here is an example of resolving a command target.  In this case, we imagine offering a Delete Kubernetes
Service command on Azure clusters.

```javascript
// package.json
{
    // ...
    "contributes": {
        "menus": {
            "view/item/context": [
                {
                    "command": "aks.deleteAKSService",
                    "when": "viewItem =~ /aks\\.cluster/i"
                }
            ]
        }
    }
}

// extension.ts
async function onDeleteService(target?: any): Promise<void> {
    const cloudExplorer = await k8s.extension.cloudExplorer.v1;
    if (!cloudExplorer.available) {
        vscode.window.showErrorMessage(cloudExplorer.reason);
        return;
    }
    const commandTarget = cloudExplorer.api.resolveCommandTarget(target);
    if (!commandTarget) {
        // invoked from somewhere other than Cloud Explorer - deal with it if
        // this is intended functionality
        return;
    }
    if (commandTarget.nodeType === 'resource') {
        const cluster: AzureClusterTreeNode = commandTarget.cloudResource;
        // cluster is now the object originally created by your TreeDataProvider
        const { resourceGroupName, name } = parseResource(cluster.armId);
        const client = new ContainerServiceClient(cluster.session.credentials, cluster.subscription.subscriptionId!);
        await client.managedClusters.delete(resourceGroupName, name);
    }
}
```


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

### Registering local redirection debug providers with the Kubernetes extension

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

Your cloud provider is now ready for testing!

## Tagging your cloud provider extension

The Local Redirection Debugger has a link for users to find providers on the Visual Studio
Marketplace.  If you'd like to appear in this link, please tag your extension
with the keyword `kubernetes-extension-local-redirection-provider` in `package.json`.
For example:

```json
{
    "keywords": [
        "kubernetes",
        "contoso",
        "megafloof",
        "kubernetes-extension-local-redirection-provider"
    ]
}
```
