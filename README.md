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
   * `draft` (optional)

If you don't have those on your PATH then the extension will fail in
unexpected ways.

For setting up `kubectl` you have a couple of additional options:

   * If `kubectl` is not on your PATH then you can tell the extension its location using the `vs-kubernetes.kubectl-path` workspace setting. This should be the full file name and path of the kubectl binary.
   * If you are using the extension to work with an Azure Container Service then you can install and configure `kubectl` using the `Kubernetes Configure from ACS` command.

For setting up `draft` you can also do this via configuration.

### Setting up the image repository path

If you want to use the `Kubernetes Run` and `Kubernetes Debug` features
then you need to have correctly set the image and repository for your
images. You can do this via preferences in VS-Code:

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

`vs-kubernetes` supports a number of commands for interacting with Kubernetes, they are accessible via the command
menu (`ctrl-shift-p`)

### General commands

   * `Kubernetes Load` - Load a resource from the Kubernetes API and create a new editor window.
   * `Kubernetes Get` - Get the status for a specific resource.
   * `Kubernetes Logs` - Get logs for a pod in an output window.

### Commands while viewing a Kubernetes file

   * `Kubernetes Explain` - Use the `kubectl explain ...` tool to annotate Kubernetes API objects
   * `Kubernetes Create` - Create an object using the current document
   * `Kubernetes Delete` - Delete an object contained in the current document.
   * `Kubernetes Apply` - Apply changes to an object contained in the current document.
   * `Kubernetes Expose` - Expose the object in the current document as a service.

### Commands for application directories

   * `Kubernetes Run` - Run the current application as a Kubernetes Deployment
   * `Kubernetes Terminal` - Open an interactive terminal session in a pod of the Kubernetes Deployment
   * `Kubernetes Exec` - Run a command in a pod of the Kubernetes Deployment
   * `Kubernetes Debug` - Run the current application as a Kubernetes Deployment and attach a debugging session to it (currently works only for Node.js deployments)
   * `Kubernetes Remove Debug` - Remove the deployment and/or service created for a `Kubernetes Debug` session

### Configuration commands

   * `Kubernetes Configure from ACS` - Install and configure the Kubernetes command line tool (kubectl) from an Azure Container Service

### Draft support

[Draft](http://blog.kubernetes.io/2017/05/draft-kubernetes-container-development.html) is a tool to simplify the process of developing a new Kubernetes application, by creating the necessary deployment components and by keeping code in the cluster in sync with the code on your computer.

  * `Kubernetes Draft: Create` - Set up Draft in the current folder (prerequisite for syncing using Draft)
  * `Kubernetes Draft: Up` - Runs Draft to watch the current folder and keep the cluster in sync with it

**NOTE:** Draft itself is in 'draft' form and is not yet stable. So the extension support for Draft is strictly experimental - assumptions may break, and commands and behavior may change!

## Extension Settings

   * `vs-kubernetes` - Parent for Kubernetes-related extension settings
       * `vs-kubernetes.namespace` - The namespace to use for all commands
       * `vs-kubernetes.kubectl-path` - File path to the kubectl binary. Note this is the binary file itself, not just the directory containing the file. On Windows, this must contain the `.exe` extension.
       * `vs-kubernetes.draft-path` - File path to the draft binary. Note this is the binary file itself, not just the directory containing the file. On Windows, this must contain the `.exe` extension.
   * `vsdocker.imageUser` - Image prefix for docker images e.g. 'docker.io/brendanburns'

## Known Issues

Nothing known (plenty unknown ;)

## Release Notes

See the [change log](changelog.md).

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
