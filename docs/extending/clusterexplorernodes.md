# Adding Nodes to Cluster Explorer

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

Typically, in this
  method you'll just look at the type and properties of the parent node, and return
  `true` if this is the place (or one of the places) that you contribute do.  You should
  _not_, in this method, contact the cluster or any other external resource.  You _don't_
  need to check here whether there are any actual nodes to add - only whether this is a
  place where you _would_ add them.  The Kubernetes extension calls `contributesChildren` to:
  * Determine if it should show a parent node as expandable when it might normally not be.
  * Determine if it should call the more expensive `getChildren` operation when computing the\
    set of child nodes.

### Implementing `getChildren`

The Kubernetes extension only
  calls `getChildren` if `contributesChildren` has returned `true` for this parent.
  `getChildren` is where you perform any cluster or other I/O activity to gather the data
  for the nodes you want to add.


### Implementing the node objects



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
