# Contributing

This project welcomes contributions and suggestions.  Most contributions require you to agree to a Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us the rights to use your contribution. For details, visit https://cla.microsoft.com.

When you submit a pull request, a CLA-bot will automatically determine whether you need to provide a CLA and decorate the PR appropriately (e.g., label, comment). Simply follow the instructions provided by the bot. You will only need to do this once across all repos using our CLA.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

## The 'Create Cluster' and 'Configure From Cluster' Commands

The 'Create Cluster' and 'Configure from Cluster' commands rely on provider-specific tools or APIs for interacting with the cloud or cluster.  We have a basic extension point for implementing new cloud providers.  **This is currently experimental and we welcome feedback.**

To implement a provider for the 'Create Cluster' and/or 'Configure from Cluster' commands, your extension needs to do the following:

* Set itself for automatic activation (the `*` activation event).  We know this isn't great and would love to discuss a better approach.
* Start a HTTP server listening on a port of your choice (see `port` below).  This HTTP server will serve up the HTML pages by which the user chooses a cluster or specifies creation settings.
* Get the VS Code Kubernetes extension's API object via the `vscode.extensions.getExtension<T>` and `Extension<T>.activate()` functions.
* The API object has a field named `clusterProviderRegistry`.  This is an object you can use to register the type(s) of cluster you support.  Call the registry's `register` method, passing an object with the following fields:
  * `id` (string): an identifier for the type of cluster.  This needs to be unique across all providers, as we use it to dispatch the user's selected cluster type to the appropriate handler.  E.g. for Azure Kubernetes Service we use `aks`.
  * `displayName` (string): the display name for the type of cluster.  E.g. for Azure Kubernetes Service we use (wait for it) `Azure Kubernetes Service`.
  * `port` (number): the port on which your provider will serve the requisite configuration pages.
  * `supportedActions` (string[]): an array of strings specifying which commands you support for this cluster type.  The supported commands are `configure` and `create` - any other strings in the array will be ignored.
* When the user choose 'Create Cluster' or 'Configure from Cluster', the extension displays a list of all registered cluster types supporting the appropriate command (using the `displayName` attribute and filtering using the `supportedActions` attribute).
* When the user selects a cluster type, the extension makes a HTTP GET request to `http://localhost:<port>/<action>?clusterType=<id>`, where `port` and `id` are the port and id associated with the cluster type in its registration, and `action` is `configure` or `create` according to which command the user is executing.
* Your HTTP server must respond to this request with a suitable first page.  From this point on it is all in your hands, though typically your first page will gather some information, and have a link either to further information-gathering pages or to perform the action immediately.

For an example of this, see the `components/clusterprovider/azure` directory.  If you have any questions or run into any problems, please post an issue - we'll be very happy to help.
