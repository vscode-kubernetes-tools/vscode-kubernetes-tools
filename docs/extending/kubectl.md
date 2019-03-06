# Invoking `kubectl`

The Kubernetes extension uses the `kubectl` command line tool, and if you're building
on top of it then we expect that you'll need to invoke `kubectl` quite a lot too!
Of course, you can always invoke `kubectl` directly using a library such as `shelljs`,
but in order to provide a consistent user experience, the Kubernetes extension
provides an API through which you can run `kubectl` using the same code paths as
the extension.  This means your tool participates in:

* Picking up the `kubectl` binary location, or a custom kubeconfig, from extension config
* Built-in option to install dependencies (if not using auto versioning)
* Automatically matching the `kubectl` version to the server version (if enabled by user)

To invoke `kubectl` through the extension API:

* Request the Kubernetes extension's Kubectl API
* Call the `invokeCommand` method passing the desired `kubectl` command and arguments

`invokeCommand` returns a promise, which resolves to either:

* An object containing the exit code, standard output and standard error of `kubectl`
* `undefined`, if the Kubernetes extension was unable to invoke `kubectl` at all

The following example uses the Kubectl API to implement a 'cordon node' command:

```javascript
import * as k8s from 'vscode-kubernetes-tools-api';

async function cordonNode(nodeId: string) {
    const kubectl = await k8s.extension.kubectl.v1;
    const result = await kubectl.invokeCommand(`cordon ${nodeId}`);

    if (!result || result.code !== 0) {
        const errorMessage = result ? result.stderr : 'Unable to invoke kubectl';
        await vscode.window.showErrorMessage(`Cordon failed: ${errorMessage}`);
        return;
    }

    await vscode.window.showInformationMessage(`${nodeId} has been cordoned`);
}
```
