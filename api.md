# Building Extensions on Top of the Kubernetes Extension

You can create extensions which layer on top of the Kubernetes extension to provide additional features or to leverage its features.  Examples include:

* Displaying additional nodes in the Cluster Explorer tree
* Adding commands to nodes in the Cluster Explorer tree
* Integrating with other cloud hosted Kubernetes services

To build on top of the Kubernetes extension, your extension must:

* Declare an extension dependency on the Kubernetes extension
* Use the VS Code extensions API to activate the Kubernetes extension
* Call the Kubernetes extension's API

## Declare an Extension Dependency

To declare an extension dependency, add the Kubernetes extension's ID to the `extensionDependencies` section in your extension's `package.json`.  The Kubernetes extension's ID is `ms-kubernetes-tools.vscode-kubernetes-tools`.  Your declaration will look like this:

```json
"extensionDependencies": [
    /* maybe other extensions */
    "ms-kubernetes-tools.vscode-kubernetes-tools"
]
```

## Activate the Kubernetes Extension

VS Code does not activate extensions automatically, so your extension must force the Kubernetes extension to become active before interacting with it.  This also gives you access to the Kubernetes extension API.

You can do this using the VS Code extensions API, as follows:

```javascript
async function k8sExtensionAPI() {
    const extnRef = vscode.extensions.getExtension("ms-kubernetes-tools.vscode-kubernetes-tools");
    if (!extnRef) {
        console.log("k8s extension not installed");
        return undefined;
    }

    const extn = await extnRef.activate();  // This is now the extension's API object
}
```

## Call the Kubernetes Extension API

The extension API object, which is returned from the `activate()` request, provides a single method, `api`.  You must pass this an object with `component` and `version` properties, to specify which API you want to use.  The method returns an object which tells you whether the request succeeded via a `succeeded` property, and if so gives access to the API via its `api` property.  For example, here is how to access version 1 of the cluster provider API from the extension API object:

```javascript
// const extn = await extnRef.activate();  // This is now the extension's API object

const clusterProviderRequest = extn.api({
    component: 'clusterprovider',
    version: '1.0'
});

if (clusterProviderRequest.succeeded) {
    const api = clusterProviderRequest.api;
    // call methods and properties on api
} else {
    console.log(`API request failed: reason code=${clusterProviderRequest.reason}`);
}
```

The methods and properties available on the selected API will depend on the API.

## Typings

For TypeScript extensions, typings are provided in `./src/api/api/vscode-kubernetes-tools-api.d.ts`.  (We'll provide a NPM package of this as part of getting the API production-ready.)  The entry point, as returned from `Extension.activate()`, is of type `APIBroker`.

## API Guide

### API Entry Point

**Extension API object** (returned from `activate()`):

`api(request)`

_Arguments_

`request`: object with `component` (string) and `version` (string) properties, indicating which version of which API you want to use.  Valid component IDs and versions are:

* Component `clusterprovider`: version `1.0`

_Returns_

Object with the following properties:

* `succeeded`: boolean, true if the requested API is available in the active version of the extension, otherwise false
* `api`: object, only present if `succeeded` is true.  If present, the methods and properties depend on which API was requested; see the specific sections of this guide, or refer to the typings file.
* `reason`: string containing a machine-readable error code, only present if `succeeded` is false.  One of the following values:
  * `APIVersionNoLongerSupported`: you are requesting an old API version, which the active version of the extension no longer supports.  You need to update your extension, or ask the user to _downgrade_ their Kubernetes extension.
  * `APIVersionUnknownInThisExtensionVersion`: you are requesting an API version which did not exist when this version of the Kubernetes extension was built.  The user needs to _upgrade_ their Kubernetes extension.  (Or you need to check that you're asking for the right version!)
  * `APIComponentUnknownInThisExtensionVersion`: similar to the previous error code, except that the entire component you're asking for didn't exist!  Again, the user needs to _upgrade_ the Kubernetes extension, or you need to check that you haven't mistyped the component.

### Cluster Providers

### Tree Commands

NOT YET IMPLEMENTED
