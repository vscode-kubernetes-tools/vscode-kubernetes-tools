# Extension API

The extension API is broken down into two sections:

* The public interface (under `./api`).  This _may only be extended, never changed_, and may not refer to anything outside of itself.  This interface is published to allow consumers of the API to work with it in a typed way.
* The implementation (under `./adapters`).  This can change as much as we like, provided any changes respect the semantics (not just the type signatures) of the previous implementation.

## Packaging the API

To package the API interface, `cd` to the `./api` directory and run `npm pack`.  This creates a `.tgz` file that can be `npm install`-ed for testing.

## Example - Registering a Cluster Provider

This shows how to register a cluster provider to participate in the Create Cluster / Add Existing Cluster wizard.

```typescript
import * as k8sapi from 'vscode-kubernetes-tools-api';
import * as cpapi from 'vscode-kubernetes-tools-api.clusterprovider.v1';

async function registerClusterProvider() {
    const cp = await k8sExtensionAPI<cpapi.API>({
        component: k8sapi.clusterProviderComponentId,
        version: cpapi.versionId
    });

    if (cp) {
        cp.clusterProviderRegistry().register(MOCK_CLOUD_PROVIDER_IMPL);
    }
}

const MOCK_CLOUD_PROVIDER_IMPL: cpapi.ClusterProvider = {
    id: "mock",
    displayName: "Managed Online Cluster Kubernetes Service",
    supportedActions: ["configure", "create"],
    async serve() {
        const s = await spinUpProvisioningWizardHTTPServer();
        return s.portNumber;
    }
}

// This is boilerplatey, but we can't put it inside our API because it's
// always up to the caller to get the extension and its entry point.
// TODO: I guess we could put it in the NPM package though, alongside the
// definitions?
async function k8sExtensionAPI<T>(apiRequest: k8sapi.APIRequest): Promise<T | undefined> {
    const extnRef = vscode.extensions.getExtension("ms-kubernetes-tools.vscode-kubernetes-tools");
    if (!extnRef) {
        console.log("k8s extension not installed");
        return undefined;
    }

    const extn = await extnRef.activate() as k8sapi.APIBroker;
    const componentAPI = extn.api(apiRequest);
    if (componentAPI.succeeded) {
        return componentAPI.api as T;
    }
    
    // NOTE: accessing 'reason' requires an 'if (succeeded === false)' check if TS is not strict
    // TODO: ^^ ugh
    switch (componentAPI.reason) {
        case 'APIVersionNoLongerSupported':
            console.log("k8s extension too new");
            return undefined;
        case 'APIVersionUnknownInThisExtensionVersion':
            console.log("k8s extension too old");
            return undefined;
    }
}
```
