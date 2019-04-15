# Extensibility Overview

## Using APIs

Visual Studio Code Kubernetes Tools offers APIs for integrating with the extension.
Currently the only API available is for writing cluster providers.  If you would like an
API for a feature which isn't currently surfaced, please post an issue on GitHub!

### Getting an API object

To access an API, you request an interface for the component you want to access, specifying
a particular version of the component API. Versioned interfaces are immutable, and existing
versions should continue to work even after a new version is available, though old versions
may eventually be retired.

The easiest way to get an interface is to use the [vscode-kubernetes-tools-api NPM
package](https://www.npmjs.com/package/vscode-kubernetes-tools-api).
Using this, you can request interfaces via convenient accessors:

```javascript
import * as k8s from 'vscode-kubernetes-tools-api';

export async function activate(context: vscode.ExtensionContext) {
    const cp = await k8s.extension.clusterProvider.v1;  // requests v1 of the cluster provider API
}
```

The accessor returns a promise, which resolves to one of the following:

* If the requested interface is available, an object with `available: true` and an `api`
  property containing the interface itself.
* If the requested interface is not available, an object with `available: false` and a `reason`
  property indicating why not. You can use the `reason` value to display appropriate user
  interface or to degrade gracefully.

(In TypeScript, these are represented by the `APIAvailable<T>` and `APIUnavailable` types.)

You can also request an interface using the VS Code extensions API:

```javascript
const extension = vscode.extensions.getExtension<APIBroker>(MS_KUBERNETES_EXTENSION_ID);
if (!extension) {
    // The extension is not present
    return undefined;
}
const apiBroker = await extension.activate();
const cp = apiBroker.get("clusterprovider", "v1");
```

(The NPM package encapsulates this in the `extension.getCore` and `extension.get` methods.)

The object returned from `activate` provides a single method `get`, which takes a component ID
and version ID, and returns using the same pattern as the result of the `await` in the previous
snippet. In terms of the TypeScript typings from the NPM package, `activate` returns an
`APIBroker`, and `get` returns an `APIAvailable<any> | APIUnavailable`.

## Supported APIs

* [Cluster Provider API](clusterprovider.md) - used for integrating new platforms into the
  Add Existing Cluster and Create Cluster commands
  * ID: `clusterprovider`
  * Versions: `v1`
* [Kubectl API](kubectl.md) - used for invoking the `kubectl` CLI consistently with the core
  extension commands and features
  * ID: `kubectl`
  * Versions: `v1`
* [Helm API](helm.md) - used for invoking the `helm` CLI consistently with the core
  extension commands and features
  * ID: `kubectl`
  * Versions: `v1`
* [Cluster Explorer API](clusterexplorer.md) - used for working with the Clusters tree
  * ID: `clusterexplorer`
  * Versions: `v1`
* [Cloud Explorer API](cloudexplorer.md) - used for working with the Clouds tree
  * ID: `cloudexplorer`
  * Versions: `v1`
