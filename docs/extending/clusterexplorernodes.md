# Adding Nodes to the Cluster Explorer

You can use the Cluster Explorer API to add new nodes to the Kubernetes extension's
Clusters tree.  For example, you might do this when you have a tool such as a
service mesh that logically belongs to a cluster but is not represented by a
Kubernetes resource definition.  Typically, adding nodes is part of a broader
feature set for working with a tool or feature - for example, offering commands, schemas or
snippets for working with that tool or feature - and the node contributor is just the part
for surfacing it in the tree.

To do this, you use the Cluster Explorer API to register a _node contributor_.  When the
Kubernetes extension builds the tree, it calls all registered node contributors to
given them the opportunity to add nodes to the ones the extension itself creates.

**NOTE:** In this API and documentation, the term 'node' refers to a element in the
Cluster Explorer display hierarchy.  It doesn't refer to a Kubernetes compute node.

## Elements of a node contributor

An object that provides nodes to be added to the cluster explorer
is called a _node contributor_.  Node contributors must be hosted within
a Visual Studio Code extension.  This table summarises what your node contributors and
their hosting extension need to do; the rest of this article goes into detail.

| Component            | Responsibilities                                                     |
|----------------------|----------------------------------------------------------------------|
| Your extension       | Activate in response to cluster explorer view activation event       |
|                      | Register node contributor(s) with Kubernetes extension               |
|                      | Associate commands (if desired) with contributed nodes               |
| Node contributor     | Implement the node contributor interface                             |
| Kubernetes extension | Display the cluster explorer tree and built-in nodes                 |
|                      | As the user expands the tree, call contributor to provide nodes      |

## Implementing a node contributor

A node contributor must implement the following interface.  (For documentation purposes
the interface is written in TypeScript terms but any JavaScript object that provides
the specified methods will do.)

```javascript
interface NodeContributor {
    contributesChildren(parent: ClusterExplorerNode | undefined): boolean;
    getChildren(parent: ClusterExplorerNode | undefined): Promise<Node[]>;
}
```

The interface is split into two methods, and it's important to understand the difference
between them.

* `contributesChildren` is a synchronous method by which the node contributor simply
  indicates if `parent` is a tree location it wants to hook into.  It's about saying
  _where your nodes will sit_... if someone were to ask for them at the right time!
* `getChildren` is (typically) an asynchronous method by which the node contributor provides
  the actual list of nodes that it wants to add under `parent`.  It's about saying
  _what nodes you want to add in this position right now_ given the current state of
  the cluster (or world).

Why have two methods?  Partly for performance - `contributesChildren` is synchronous
so you can implement it without incurring a promise - but also because we need to
be able to quickly mark parent nodes as expandable without actually calculating
their children (and to do so if they are _potentially_ expandable even if they don't
have any children in this particular configuration).  We'll see how this plays out
as we talk about implementing the methods.

### Implementing `contributesChildren`

The Kubernetes extension calls `contributesChildren` to:
* Determine if it should show a parent node as expandable when it might normally not be.
* Determine if it should call the more expensive `getChildren` operation when computing the\
  set of child nodes.

In `contributesChildren`, you should assess only "is this the (or a) place in the tree
where I might want to display nodes?"  If so, return `true`; otherwise, return `false`.

Typically, in this method you'll just look at the type and properties of the parent
node.  You should _not_, in this method, contact the cluster or any other external resource.
You _don't_ need to check here whether there are any actual nodes to add - only whether this is a
place where you _might be interested_ in adding them.  For example, suppose your extension
applies to services, and displays the details of any cloud native load balancers associated
with load-balanced services.  The only place you are interested in adding nodes is under
service resources.  So `contributesChildren` should check for that, but does _not_ need to
check whether there are any load balancers associated with the service:

```javascript
class LoadBalancerNodeContributor {
    contributesChildren(parent: ClusterExplorerNode | undefined): boolean {
        return parent && parent.nodeType === 'resource' && parent.resourceKind.manifestKind === 'Service';
    }
}
```

### Implementing `getChildren`

The Kubernetes extension calls `getChildren` when the user expands a parent for which `contributesChildren`
has returned `true`.  `getChildren` is where you perform any cluster or other I/O activity
to gather the data for the nodes you want to add.  You must return a promise which resolves to
an array whose items conform to the following interface:

```javascript
interface Node {
    getChildren(): Promise<Node[]>;
    getTreeItem(): vscode.TreeItem;
}
```

Your node object should implement `getTreeItem` to return a Visual Studio Code TreeItem instance
specifying how it would like to be displayed (e.g. label, tooltip, whether it's expandable).
If the node has children, it should implement `getChildren` to calculate those; otherwise, it can
simply return the promise of an empty array.

Revisiting the example of displaying cloud native load balancers under load-balanced services:

```javascript
class LoadBalancerNodeContributor {
    async getChildren(parent: ClusterExplorerNode | undefined): Promise<Node[]> {
        if (parent && parent.nodeType === 'resource' && parent.resourceKind.manifestKind === 'Service') {
            const serviceName = parent.name;
            const serviceNamespace = parent.namespace || 'default';
            const loadBalancers = await listLoadBalancersForService(serviceNamespace, serviceName, CLOUD_CREDENTIALS);
            return loadBalancers.map((lb) => new LoadBalancerNode(lb));
        }
        return [];
    }
}

class LoadBalancerNode implements Node {
    constructor(private readonly lb: CloudLoadBalancer) {}
    async getChildren(): Promise<Node[]> {
        return [];  // no children in this case
    }
    getTreeItem(): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(this.lb.ID, vscode.TreeItemCollapsibleState.None);
        treeItem.tooltip = this.lb.IPAddress;
        return treeItem;
    }
}
```

It's quite possible that, when you look at the state of the cluster and the world, you find
you don't want to display any nodes after all, even though you returned `true` from
`contributesChildren`.  That's okay!  `contributesChildren` says only "I'm interested in
this location," not "I promise there will be nodes here."  Just return an empty array from
`getChildren` in this case.

### Implementing node hierarchies

The node contributor's `getChildren` is responsible only for returning the first level of nodes
you want to inject into the tree.  If you want to inject a multi-level hierarchy, then these
initial nodes are responsible for returning their own children.  The node contributor won't
be called again for these.  ### TODO: OR WILL IT? ###

Let's extend the load balancer example to show multiple IP addresses as child nodes of the load
balancer:

```javascript
class LoadBalancerNode implements Node {
    constructor(private readonly lb: CloudLoadBalancer) {}
    async getChildren(): Promise<Node[]> {
        const addresses = await lb.queryIPAddresses(CLOUD_CREDENTIALS);
        return addresses.map((a) => new LoadBalancerAddressNode(a));
    }
    getTreeItem(): vscode.TreeItem {
        return new vscode.TreeItem(this.lb.ID, vscode.TreeItemCollapsibleState.Expandable);
    }
}

class LoadBalancerAddressNode implements Node {
    constructor(private readonly address: string) {}
    async getChildren(): Promise<Node[]> {
        return [];
    }
    getTreeItem(): vscode.TreeItem {
        return new vscode.TreeItem(this.address, vscode.TreeItemCollapsibleState.None);
    }
}
```

### Built-in node contributors

In some cases you do not need completely custom behaviour - you just want something that works
like the built-in tree nodes.  You can use the API to create your own _resource folders_
and _grouping folders_ using the `nodeSources` property, and display them in the tree.

A _resource folder_ is a folder which displays a single Kubernetes resource type, such as
a Services or Pods folder.

A _grouping folder_ is a folder which contains other folders, such as the Storage folder
which contains resource folders for Persistent Volumes, Persistent Volume Claims and
Storage Classes.

To use a built-in node contributor, call the appropriate `nodeSources` method to create
a `NodeSource`, then use its `at` method to specify where to attach to the tree.
The `at` method may specify an existing grouping folder (specified by display name), or
`undefined` to appear directly under the context tree node.

For example, to display network policies under the Network folder:

```javascript
clusterExplorer.api.registerNodeContributor(
    clusterExplorer.api.nodeSources.resourceFolder("Network Policy", "Network Policies", "NetworkPolicy", "netpol").at("Network")
);
```

Or to display a Security grouping folder directly under the context, and display folders for roles and so on under it:

```javascript
clusterExplorer.api.registerNodeContributor(
    clusterExplorer.api.nodeSources.groupingFolder("Security", undefined,
        clusterExplorer.api.nodeSources.resourceFolder("Role", "Roles", "Role", "roles"),
        clusterExplorer.api.nodeSources.resourceFolder("Role Binding", "Role Bindings", "RoleBinding", "rolebindings"),
        clusterExplorer.api.nodeSources.resourceFolder("Cluster Role", "Cluster Roles", "ClusterRole", "clusterroles"),
        clusterExplorer.api.nodeSources.resourceFolder("Cluster Role Binding", "Cluster Role Bindings", "ClusterRoleBinding", "clusterrolebindings")
).at(undefined));
```

You can also use the `if` method to conditionally display nodes:

```javascript
clusterExplorer.api.registerNodeContributor(
    clusterExplorer.api.nodeSources.resourceFolder("Contoso Backup", "Contoso Backups", "ContosoBackup", "contosobackups")
        .if(isContosoBackupOperatorInstalled)
        .at("Storage")
);

async function isContosoBackupOperatorInstalled(): Promise<boolean> {
    const sr = await kubectl.api.invokeCommand('get crd');
    if (!sr || sr.code !== 0) {
        return false;
    }
    return sr.stdout.includes("backup.k8soperators.contoso.com");  // Naive check to keep example simple!
}
```

## Registering the node contributor

In order to have nodes displayed in the cluster explorer, a node contributor must be _registered_
with the Kubernetes extension.  This is the responsibility of the VS Code extension that hosts
the node contributor.  To do this, the extension must:

* Activate in response to the `onView:extension.vsKubernetesExplorer` activation event
* Request the Kubernetes' extension's Cluster Explorer API
* Call the `registerNodeContributor` method for its node contributor object

### Activating your extension

Your extension needs to activate in response to the Cluster Explorer being displayed,
so that it can register its node contributor(s) before the tree is
displayed.  To do this, your `package.json` must include the following activation events:

```json
    "activationEvents": [
        "onView:extension.vsKubernetesExplorer"
    ],
```

Depending on your extension you may have other activation events as well.

### Registering node contributors with the Kubernetes extension

In your extension's `activate` function, you must register your node contributor(s) using the
Kubernetes extension API.  The following sample shows how to do this using the NPM
helper package; if you don't use the helper then the process of requesting the API is
more manual but the registration is the same.

```javascript
import * as k8s from 'vscode-kubernetes-tools-api';

const LOAD_BALANCER_NODE_CONTRIBUTOR = new LoadBalancerNodeContributor();

export async function activate(context: vscode.ExtensionContext) {
    const explorer = await k8s.extension.clusterExplorer.v1;

    if (!explorer.available) {
        console.log("Unable to register node contributor: " + explorer.reason);
        return;
    }

    explorer.api.registerNodeContributor(LOAD_BALANCER_NODE_CONTRIBUTOR);
}
```

Your new cluster explorer nodes are now ready for testing!
