# Contributing

This project welcomes contributions and suggestions.  Most contributions require you to agree to a Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us the rights to use your contribution. For details, visit https://cla.microsoft.com.

When you submit a pull request, a CLA-bot will automatically determine whether you need to provide a CLA and decorate the PR appropriately (e.g., label, comment). Simply follow the instructions provided by the bot. You will only need to do this once across all repos using our CLA.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

## The 'Create Cluster' and 'Configure From Cluster' Commands

The 'Create Cluster' and 'Configure from Cluster' commands rely on provider-specific tools or APIs for interacting with the cloud or cluster.  Unfortunately, we don't have a general-purpose, API-style extension point for implementing new cloud providers, because we don't know enough about how configuring different cluster types might work in different environments.

At the moment, the extension provides a generic (albeit fiddly) mechanism for managing a series of pages in a UI (example: displaying a list of accounts for the user to choose from), invoking tools or APIs for populating state to be used in constructing those pages (example: invoking the Azure CLI to get a list of subscriptions), and flowing choices and state between those pages (example: returning the selected account so that another tool can list the clusters in that account).  However, the cloud-specific pages and logic have to be built using artisanal TypeScript and built into this extension via pull request - we don't provide a nice way for you to externalise different providers.

We'd be _really really happy_ to work with anyone wanting to implement providers for e.g. minikube, GKE, EKS, etc., both to help you understand how the existing implementation works, and to collaborate on simplifying and stabilising an extension mechanism.
