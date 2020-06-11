# Detecting the Kubernetes Configuration

When your extension invokes `kubectl` or `helm` via the respective APIs, the Kubernetes
extension ensures that they run with the same configuration as the extension is using,
so that you don't accidentally fetch data from or apply changes to the wrong cluster.

However, when your extension invokes your own tools, or calls the Kubernetes API via a
library, you should make sure that you use the same `kubeconfig` that the extension is
using, as the user may have overridden the default or environment `kubeconfig`.  To do
this, you can use the Configuration API.

To obtain the `kubeconfig` that the extension is using through the extension API:

* Request the Kubernetes extension's Configuration API
* Call the `getKubeconfigPath` method

`getKubeconfigPath` returns a promise, which resolves to an object containing a `pathType`
attribute.  The actual path is in another property depending on the value of `pathType`.

| `pathType`   | Properties                                                           |
|--------------|----------------------------------------------------------------------|
| `host`       | `hostPath` - string containing the kubeconfig file path                                   |
| `wsl`        | `wslPath` - string containing the kubeconfig file path in the Windows Subsystem for Linux |

If the `pathType` is `host` then you can use the `hostPath` on the OS filesystem normally,
for example by setting an environment variable or by using the Node `fs` module.

If the `pathType` is `wsl`, then you are on Windows but the user has configured the extension
to run `kubectl` via WSL, so the `wslPath` should be interpreted as a Unix path in the WSL
filesystem.  In this scenario, you should try to run your tool via WSL using `wsl.exe` if it
makes sense for your use case, passing it the given path for it to resolve in the WSL environment.
_Do not use the `fs` module or other Node modules running on the host to access the `wslPath`._
If you don't support the WSL configuration setting, then you should fail gracefully.

The following example uses the Configuration API to run a third party tool with the same
`kubeconfig` as the extension:

```javascript
import * as k8s from 'vscode-kubernetes-tools-api';

async function runMyTool() {
    const configuration = await k8s.extension.configuration.v1;
    if (!configuration.available) {
        return;
    }
    const path = await configuration.api.getKubeconfigPath();

    if (path.pathType === 'host') {
        const childProcess = shelljs.exec(`mytool --kubeconfig ${path.hostPath}`);
        // ...do things with childProcess...
    } else if (path.pathType === 'wsl') {
        // WSL-aware:
        const childProcess = shelljs.exec(`wsl mytool --kubeconfig ${path.wslPath}`);
        // Non-WSL-aware:
        // vscode.window.showErrorMessage('This command is not supported on WSL.');
    } else {
        vscode.window.showErrorMessage('This command is not supported in your current configuration.');
    }
}
```

## Detecting Kubernetes context change

If your extension need to react on context change you may use `onDidChangeContext` event.
It fires when the extensions changes the Kubernetes context (current active cluster).

To subscribe to `onDidChangeContext` event:

* Request the Kubernetes extension's Configuration API
* Use `onDidChangeContext` to pass your even listener function.

Your event listener will receive the new cluster identifier string or `null` if there is no active cluster.

Example:

```javascript
import * as k8s from 'vscode-kubernetes-tools-api';

async function refreshWhenK8sContextChange() {
    const configuration = await k8s.extension.configuration.v1_1;
    if (!configuration.available) {
        return;
    }
    configuration.api.onDidChangeContext((e) => {
        // current context is changed, do something with it
    });
}
```

## Detecting Kubernetes namespace change

If your extension need to react on namespace change you may use `onDidChangeNamespace` event.

To subscribe to `onDidChangeNamespace` event:

* Request the Kubernetes extension's Configuration API
* Use `onDidChangeNamespace` to pass your even listener function.

Your event listener will receive the new namespace name.

Example:

```javascript
import * as k8s from 'vscode-kubernetes-tools-api';

async function refreshWhenK8sContextChange() {
    const configuration = await k8s.extension.configuration.v1_1;
    if (!configuration.available) {
        return;
    }
    configuration.api.onDidChangeNamespace((e) => {
        // current namespace is changed, do something with it
    });
}
```

## Detecting Kubernetes config path change

This extension allows users to have multiple Kubernetes config files and provides UI to switch between them.
If in you want to react, when extension change path to config file, you may use `onDidChangeKubeconfigPath` event.

To subscribe to `onDidChangeKubeconfigPath` event:

* Request the Kubernetes extension's Configuration API
* Use `onDidChangeKubeconfigPath` to pass your event listener function.

Your event listener will receive same object as `getKubeconfigPath` provide.

Example:

```javascript
import * as k8s from 'vscode-kubernetes-tools-api';

async function detectK8sConfigPathChange() {
    const configuration = await k8s.extension.configuration.v1_1;
    if (!configuration.available) {
        return;
    }
    configuration.api.onDidChangeKubeconfigPath((e) => {
        // path to config file is changed, do something with it
    });
}
```
