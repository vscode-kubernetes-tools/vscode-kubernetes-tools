# Invoking `helm`

The Kubernetes extension provides an API to invoke the Helm command line.
As with `kubectl`, you can of course invoke `helm` directly using a library
such as `shelljs`, but using the API gives your users a consistent user
experience, for example in terms of error handling or offering to install
it if missing.

To invoke `helm` through the extension API:

* Request the Kubernetes extension's Helm API
* Call the `invokeCommand` method passing the desired `helm` command and arguments

`invokeCommand` returns a promise, which resolves to either:

* An object containing the exit code, standard output and standard error of `helm`
* `undefined`, if the Kubernetes extension was unable to invoke `helm` at all

The following example uses the Helm API to install Weave Scope:

```javascript
import * as k8s from 'vscode-kubernetes-tools-api';

async function installScope() {
    const helm = await k8s.extension.helm.v1;
    if (!helm.available) {
        return;
    }
    const result = await helm.api.invokeCommand(`install stable/weave-scope`);

    if (!result || result.code !== 0) {
        const errorMessage = result ? result.stderr : 'Unable to invoke helm';
        await vscode.window.showErrorMessage(`Installing Scope failed: ${errorMessage}`);
        return;
    }

    await vscode.window.showInformationMessage('Scope has been installed');
}
```


