# Attaching Commands to the Cluster Explorer

The Kubernetes extension's _cluster explorer_ is the tree view which displays
the user's clusters and the resources within those clusters.  You can attach your
own commands to those resources using the normal Visual Studio Code contribution
mechanism.

## Contributing Commands

To add commands to the cluster explorer, first declare the command in the
`contributes/commands` section of `package.json`, just as you normally would.
Then add references to the command to the `contributes/menus` section according
to where you want the command to appear in the cluster explorer.  You can have
the command appear in multiple places if it makes sense for you - just add
multiple entries under `contributes/menus`.  The following sections describe how
to add commands in various places.

### Cluster Explorer Title Bar

To display a command in the title bar, add an entry to the `view/title` section
with a `when` clause of `view == extension.vsKubernetesExplorer`.

```json
{
    "contributes": {
        "menus": {
            "view/title": [
                {
                    "command": "kcswitcher.switchKubeconfig",
                    "when": "view == extension.vsKubernetesExplorer"
                },
            ]
        }
    }
}
```

### Cluster Explorer Node Right-Click

To display a command when the user right-clicks an item in the cluster explorer,
add an entry to the `view/item/context` section with a `when` clause matching
the type of node that you want to display on.  You can display on multiple types
of node using multiple entries, or a `when` clause that matches all the desired
types.

| Node type | nodeType string | TypeScript interface | Sample `when` clause|
|-----------|-----------------|----------------------|---------------------|
| Active cluster   | `context` | ClusterExplorerContextNode | `viewItem =~ /vsKubernetes\.\w*cluster/i` |
| Inactive cluster | `context.inactive` | ClusterExplorerInactiveContextNode | `viewItem =~ /vsKubernetes\.\w*cluster\.inactive/i` |
| Resource         | `resource` | ClusterExplorerResourceNode | `viewItem =~ /vsKubernetes\.resource\.pod/i` |
| Resource folder  | `folder.resource` | ClusterExplorerResourceFolderNode | `viewItem =~ /vsKubernetes\.kind/i` |
| Grouping folder  | `folder.grouping` | ClusterExplorerGroupingFolderNode | Varies by folder |
| Config data item | `configitem` | ClusterExplorerConfigDataItemNode | `viewItem =~ /vsKubernetes\.file/i` |
| Helm release     | `helm.release` | ClusterExplorerHelmReleaseNode | `viewItem =~ /vsKubernetes\.helmrelease/i` |

**NOTE:** When writing `when` clauses in `package.json`, remember to escape backslashes.
For example, to display a command on pods, write `"when": "viewItem =~ /vsKubernetes\\.resource\\.pod/i"`

**IMPORTANT:** Although we document the item context names from the current version
of the extension, it's possible that these will change over time, and Code doesn't
give us a way to version them.  We therefore strongly recommend using regular
expressions rather than exact matches in your `when` clause; if we do need to change
something, we'll try to keep the existing string in the new name, so regexps
will continue to work when exact matches would not.


```json
{
    "contributes": {
        "menus": {
            "view/item/context": [
                {
                    "command": "k8sops.cordon",
                    "when": "view == extension.vsKubernetesExplorer && viewItem =~ /vsKubernetes\\.resource\\.node/i"
                },
                {
                    "command": "k8sops.top",
                    "when": "view == extension.vsKubernetesExplorer && viewItem =~ /vsKubernetes\\.resource\\.(node|pod)/i"
                }
            ]
        }
    }
}
```

## Implementing Right-Click Commands

When the user selects a command from a cluster explorer right-click menu, Visual Studio Code
passes the cluster explorer node object as an argument to the command handler.  **Your code
should treat this object as undocumented and opaque.**  To find out which resource (or other
object) the user clicked, use the Command Targets API to _resolve_ the argument, as follows:

* Request the Kubernetes extension's Cluster Explorer API
* Call the `resolveCommandTarget` method passing the opaque object that Code passed to your command handler
* If the object resolves, use `nodeType` attribute to determine the
  type of node, and appropriate properties to obtain type-specific information such as
  context name, resource ID, etc.  See the NPM package for the different node schemas.

In the following example, the `top` command is displayed on both node and pod resources, and
the command handler needs to distinguish which was clicked and obtain the name.

```javascript
function onTop(target?: any) {
    const clusterExplorer = await k8s.extension.clusterExplorer.v1;
    const commandTarget = clusterExplorer.resolveCommandTarget(target);

    if (commandTarget) {
        if (commandTarget.nodeType === 'resource') {
            if (commandTarget.resourceKind.manifestKind === 'Pod') {
                const podNamespace = commandTarget.namespace || 'default';
                const podName = commandTarget.name;
                runTopPodCommand(podNamespace, podName);
                return;
            } else if (commandTarget.resourceKind.manifestKind === 'Node') {
                const nodeName = commandTarget.name;
                runTopNodeCommand(nodeName);
                return;
            }
        } else {
            // In this case we assume the Top command is not displayed on any other objects
            // in the cluster explorer, so this shouldn't happen.  But if you displayed a
            // command on, say, both the context and namespace nodes, then you would need
            // to handle both those cases.
        }
    } else {
        // The user selected the Top command from the command palette or from
        // somewhere else that you were displaying it.
    }
}
```

**NOTE:** The Cluster Explorer API only resolves command targets from the Kubernetes extension
Clusters tree view.  If your command also appears in other places, `resolveCommandTarget` will return `undefined` for
those cases and it's up to you to work out the target and extract the data you need.
For example, if you display your command both on Kubernetes resources and on YAML files
in the file explorer, the latter will pass a `vscode.Uri` to the command handler, which
`resolve` won't help you with!  For example:

```javascript
// This command appears on the command palette, cluster explorer and file explorer
function onReticulate(target?: any) {
    if (!target) {
        // From command palette - e.g. prompt or default
    }
    const k8sTarget = clusterExplorer.resolveCommandTarget(target);
    if (k8sTarget) {
        // From Cluster Explorer tree view - use resolved object to determine actual target
    }
    // Neither of the above - it must be from the file explorer
    const uriTarget = target as vscode.Uri;
}
```

It is safe to pass `undefined` (indicating no command target) to `resolve` (which will
return `undefined`).
