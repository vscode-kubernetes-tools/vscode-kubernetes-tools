# Changing the Appearance of the Cluster Explorer

You can use the Cluster Explorer API to change the appearance of nodes in the Kubernetes extension's
Clusters tree.  For example, you might do this to display status or to indicate that
a resource or cluster is of a special type.

To do this, you use the Cluster Explorer API to register a _node UI customizer_.  When the
Kubernetes extension displays the tree, it calls all registered node UI customizers to
given them the opportunity to modify the displayed tree item.

**NOTE:** In this API and documentation, the term 'node' refers to a element in the
Cluster Explorer display hierarchy.  It doesn't refer to a Kubernetes compute node.

## Elements of a node UI customizer

An object that changes the appearance of nodes in the cluster explorer
is called a _node UI customizer_.  Node UI customizers must be hosted within
a Visual Studio Code extension.  This table summarises what your node UI customizers and
their hosting extension need to do; the rest of this article goes into detail.

| Component            | Responsibilities                                                     |
|----------------------|----------------------------------------------------------------------|
| Your extension       | Activate in response to cluster explorer view activation event       |
|                      | Register node UI customizer(s) with Kubernetes extension             |
| Node UI customizer   | Implement the node UI customizer interface                           |
| Kubernetes extension | Display the cluster explorer tree                                    |
|                      | As tree nodes are rendered, call customizer to modify tree items     |

## Implementing a node UI customizer

A node UI customizer must implement the following interface.  (For documentation purposes
the interface is written in TypeScript terms but any JavaScript object that provides
the specified methods will do.)

```javascript
interface NodeUICustomizer {
    customize(node: ClusterExplorerNode, treeItem: vscode.TreeItem): void | Thenable<void>;
}
```

The Kubernetes extension calls `customize` every time Visual Studio Code wants to display
a node in the tree.  If you are familiar with the VS Code `TreeDataProvider` interface,
this corresponds to the `getTreeItem` method, except that your customizer is being given
the opportunity to _modify_ a `vscode.TreeItem` that has already been created rather than
being required to create one itself.

If the `node` is not one that you want to customize, your `customize` method should return
synchronously without doing anything.  You can usually quickly determine this from the
`node.nodeType` or specific properties such as the `resourceKind` of a resource node.

Similarly, if you can customize based on the properties of the `node` object alone, you should
do so by setting properties on the `treeItem` argument, and return synchronously.

If you need to do additional asynchronous work to determine whether or how to customize the
tree item, your `customize` method can return asynchronously.  Typically, you will
split your implementation into a synchronous `customize` method and an `async` helper
method; this avoids the overhead of resolving a promise for _every_ node.

In the following example, we want to customize only context nodes.  So in `customize` we
check the node type and return immediately if it's not a context.  Otherwise we hand
off to an `async` call that is only incurred for contexts.

```javascript
class VersionSuffixer {
    // Synchronous so it can return immediately for nodes that aren't of interest
    customize(node: k8s.ClusterExplorerV1.ClusterExplorerNode, treeItem: vscode.TreeItem): void | Thenable<void> {
        if (node.nodeType === 'context' || node.nodeType === 'context.inactive') {
            return this.customizeContextNode(node.name, treeItem);  // returns a Thenable
        }
        // returns nothing (but returns it quickly!)
    }

    // Asynchronous to conveniently do long-running work where required
    private async customizeContextNode(contextName: string, treeItem: vscode.TreeItem): Promise<void> {
        const serverVersion = await clusterVersion(contextName);
        if (serverVersion.length > 0) {
            treeItem.label = `${treeItem.label} [${serverVersion}]`;
        }
    }
}
```

The actual customization is carried out by setting properties on the `treeItem` passed into the
`customize` method.  See the Visual Studio Code documentation for these properties.

### Working in a shared user interface

The Cluster Explorer tree doesn't belong to your extension just because the user installed it.
The user will likely still want to use the base Kubernetes functionality, and may have
other extensions installed that they also want the customizations from.  So when
designing your customizations, be considerate of the core functions and other extensions
with which you are sharing the user interface!  Some guidelines to bear in mind:

* If the user has multiple extensions registering customizers, there is no guarantee
  what order they will be called in.  Sometimes you may not be able to avoid treading
  on someone else's toes - for example if two extensions both want to modify the same
  icon.  But if you can append or prepend information (for example when modifying
  the label or tooltip) rather than overwriting it completely, that's likely to be
  play nicer with others!
* When modifying a tree item, try to base your new value on the _existing value_,
  rather than directly on the node properties.  In the example above, note that
  the new `label` is set as `${treeItem.label} [${serverVersion}]` rather than
  `${contextName} [${serverVersion}]`.  This preserves any existing customizations
  to the label.
* Avoid modifying `contextValue`.  If you need to modify it, be sure to _add_ to the
  existing value rather than replacing it.  This improves your chances of not breaking
  commands that are contributed to that node.

## Registering the node UI customizer

In order to modify nodes in the cluster explorer, a node UI customizer must be _registered_
with the Kubernetes extension.  This is the responsibility of the VS Code extension that hosts
the customizer.  To do this, the extension must:

* Activate in response to the `onView:extension.vsKubernetesExplorer` activation event
* Request the Kubernetes' extension's Cluster Explorer API
* Call the `registerNodeUICustomizer` method for its node UI customizer object

### Activating your extension

Your extension needs to activate in response to the Cluster Explorer being displayed,
so that it can register its node UI customizer(s) before the tree is
displayed.  To do this, your `package.json` must include the following activation events:

```json
    "activationEvents": [
        "onView:extension.vsKubernetesExplorer"
    ],
```

Depending on your extension you may have other activation events as well.

### Registering node UI customizers with the Kubernetes extension

In your extension's `activate` function, you must register your node UI customizer(s) using the
Kubernetes extension API.  The following sample shows how to do this using the NPM
helper package; if you don't use the helper then the process of requesting the API is
more manual but the registration is the same.

```javascript
import * as k8s from 'vscode-kubernetes-tools-api';

const SERVER_VERSION_NODE_CUSTOMIZER = new VersionSuffixer();

export async function activate(context: vscode.ExtensionContext) {
    const explorer = await k8s.extension.clusterExplorer.v1;

    if (!explorer.available) {
        console.log("Unable to register node customizer: " + explorer.reason);
        return;
    }

    explorer.api.registerNodeUICustomizer(SERVER_VERSION_NODE_CUSTOMIZER);
}
```

Your updated user experience is now ready for testing!

