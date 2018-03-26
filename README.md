# Visual Studio Code Kubernetes Tools

A Visual Studio Code extension for interacting with Kubernetes clusters.  This extension combines
the `vs-kubernetes` extension by @brendandburns and the `vs-helm` extension by @technosophos.

## Configuring

### Setting up your environment

This extension assumes that you have a `Dockerfile` in the root directory of
your project.

It also assumes that you have the following binaries on your `PATH`:
   * `kubectl`
   * `docker`
   * `git`
   * `helm` (optional)
   * `draft` (optional)

If you don't have those on your PATH then the extension will fail in
unexpected ways.

For setting up `kubectl` you have a couple of additional options:

   * If `kubectl` is not on your PATH then you can tell the extension its location using the `vs-kubernetes.kubectl-path` workspace setting. This should be the full file name and path of the kubectl binary.
   * If you are using the extension to work with Azure Container Services or Azure Kubernetes Services then you can install and configure `kubectl` using the `Kubernetes: Add Existing Cluster` command.

If you plan to create managed clusters using Microsoft Azure (ACS or AKS), or to add clusters in those environments to your kubeconfig, then you will need Azure CLI 2.0.23 or above.  You do not need Azure CLI if you do not use Azure, or to interact with Azure clusters that are already in your kubeconfig.

### Setting up your environment for Helm and Draft

`helm` support requires that you have Helm installed and configured.  From there you should also install `helm-template`:

`$ helm plugin install https://github.com/technosophos/helm-template`

To use the `Helm: DryRun` command, your Kubernetes cluster must be running Tiller.

For setting up `draft` you can provide a path to the binary via configuration (`vs-kubernetes.draft-path`) if it is not on your PATH.

### Setting up the image repository path

If you want to use the `Kubernetes: Run` and `Kubernetes: Debug` features
then you need to have correctly set the user and repository for your
images. You can do this via preferences in VS Code:

File > Preferences

And then add:

```javascript
{
  ...
  "vsdocker.imageUser": "<your-image-prefix-here>",
  ...
}
```

Where `<your-image-prefix-here>` is something like `docker.io/brendanburns`.

## Features

`vs-kubernetes` supports a number of commands for interacting with Kubernetes; these are accessible via the command menu (`Ctrl+Shift+P`) and may be bound to keys in the normal way.

### General commands

   * `Kubernetes: Load` - Load a resource from the Kubernetes API and create a new editor window.
   * `Kubernetes: Get` - Get the status for a specific resource.
   * `Kubernetes: Logs` - Get logs for a pod in an output window.

### Commands while viewing a Kubernetes file

   * `Kubernetes: Explain` - Use the `kubectl explain ...` tool to annotate Kubernetes API objects
   * `Kubernetes: Create` - Create an object using the current document
   * `Kubernetes: Delete` - Delete an object contained in the current document.
   * `Kubernetes: Apply` - Apply changes to an object contained in the current document.
   * `Kubernetes: Expose` - Expose the object in the current document as a service.

### Commands for application directories

   * `Kubernetes: Run` - Run the current application as a Kubernetes Deployment
   * `Kubernetes: Terminal` - Open an interactive terminal session in a pod of the Kubernetes Deployment
   * `Kubernetes: Exec` - Run a command in a pod of the Kubernetes Deployment
   * `Kubernetes: Debug (Launch)` - Run the current application as a Kubernetes Deployment and attach a debugging session to it (currently works only for Java/Node.js deployments). See [Debug support on Kubernetes cluster](https://github.com/Azure/vscode-kubernetes-tools/blob/master/debug-on-kubernetes.md) for more details.
   * `Kubernetes: Debug (Attach)` - Attach a debugging session to an existing Kubernetes Deployment (currently works only for Java deployments). See [Debug support on Kubernetes cluster](https://github.com/Azure/vscode-kubernetes-tools/blob/master/debug-on-kubernetes.md) for more details.
   * `Kubernetes: Remove Debug` - Remove the deployment and/or service created for a `Kubernetes Debug (Launch)` session
   * `Kubernetes: Sync Working Copy to Cluster` - Checks out the version of the code that matches what is deployed in the cluster.  (This relies on Docker image versions also being Git commit IDs, which the extension does if you use the Run command to build the container, but which typically doesn't work for containers/deployments done by other means.)

### Configuration commands

   * `Kubernetes Add Existing Cluster` - Install and configure the Kubernetes command line tool (kubectl) from a cloud cluster, such as an Azure Container Service (ACS) or Azure Kubernetes Service (AKS) cluster


### Miscellaneous commands

   * `Kubernetes Open Dashboard` - Opens the Kubernetes Dashboard in your browser.

### Helm support

[Helm](https://helm.sh/) is the package manager for Kubernetes and provides a way for you to define, install and upgrade applications using 'charts.'  This extension provides a set of tools for creating and testing Helm charts:


   * Syntax highlighting for YAML + Helm Templates
   * Autocomplete for Helm, Sprig, and Go Tpl functions
   * Help text (on hover) for Helm, Sprig, and Go Tpl functions
   * Snippets for quickly scaffolding new charts and templates
   * Commands for...
     * `Helm: Lint` - Lint your chart
     * `Helm: Preview Template` - Open a preview window and preview how your template will render
     * `Helm: Template` - Run your chart through the template engine
     * `Helm: DryRun` - Run a helm install --dry-run --debug on a remote cluster and get the results
     * `Helm: Version` - Get the Helm version
     * `Helm: Dependency Update` - Update a chart's dependencies.
   * Code lenses for:
     * requirements.yaml (Add and update dependencies)
   * Right-click on a chart .tgz file, and choose inspect chart to preview all configurable chart values.

### Draft support

[Draft](http://blog.kubernetes.io/2017/05/draft-kubernetes-container-development.html) is a tool to simplify the process of developing a new Kubernetes application, by creating the necessary deployment components and by keeping code in the cluster in sync with the code on your computer.

  * `Draft: Create` - Set up Draft in the current folder (prerequisite for syncing using Draft)
  * `Draft: Up` - Runs Draft to watch the current folder and keep the cluster in sync with it

**NOTE:** Draft itself is in 'draft' form and is not yet stable. So the extension support for Draft is strictly experimental - assumptions may break, and commands and behavior may change!

## Extension Settings

   * `vs-kubernetes` - Parent for Kubernetes-related extension settings
       * `vs-kubernetes.namespace` - The namespace to use for all commands
       * `vs-kubernetes.kubectl-path` - File path to the kubectl binary. Note this is the binary file itself, not just the directory containing the file. On Windows, this must contain the `.exe` extension.
       * `vs-kubernetes.draft-path` - File path to the draft binary. Note this is the binary file itself, not just the directory containing the file. On Windows, this must contain the `.exe` extension.
       * `vs-kubernetes.autoCleanupOnDebugTerminate` - The flag to control whether to auto cleanup the created deployment and associated pod by the command "Kubernetes: Debug (Launch)". The cleanup action occurs when it failed to start debug session or debug session terminated. If not specified, the extension will prompt for whether to clean up or not. You might choose not to clean up if you wanted to view pod logs, etc.
   * `vsdocker.imageUser` - Image prefix for docker images e.g. 'docker.io/brendanburns'

## Known Issues

  * `Kubernetes: Debug` command currently works only with Node.js applications
  * For deeply nested Helm charts, template previews are generated against highest (umbrella) chart values (though for `Helm: Template` calls you can pick your chart)

## Release Notes

See the [change log](CHANGELOG.md).

## Telemetry
This extension collects telemetry data to help us build a better experience for building applications with Kubernetes and VS Code. We only collect the following data:

* Which commands are executed
* For the `Create Cluster` and `Configure from Cluster` commands, the cluster type selected.
 
We do not collect any information about image names, paths, etc. The extension respects the `telemetry.enableTelemetry` setting which you can learn more about in our [FAQ](https://code.visualstudio.com/docs/supporting/faq#_how-to-disable-telemetry-reporting).

# Contributing

This project welcomes contributions and suggestions.  Most contributions require you to agree to a
Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us
the rights to use your contribution. For details, visit https://cla.microsoft.com.

When you submit a pull request, a CLA-bot will automatically determine whether you need to provide
a CLA and decorate the PR appropriately (e.g., label, comment). Simply follow the instructions
provided by the bot. You will only need to do this once across all repos using our CLA.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

For technical information about contributing, see [CONTRIBUTING.md](CONTRIBUTING.md).
