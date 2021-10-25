# azure.github.io/vscode-kubernetes-tools

This is a simple [Hugo](https://gohugo.io/) one-page website for the vscode-kubernetes-tools Extension. It is hosted via the project repo's [Github Pages config](https://github.com/Azure/vscode-kubernetes-tools/settings/pages).

To update the site, open the `/site` directory and install the dependencies:

* Install Hugo - see the [docs here](https://gohugo.io/getting-started/quick-start/)
* Install Yarn `npm install --global yarn`
* Install the other NPM packages by ruinning  `yarn`
* Run `hugo serve` to run the site in local development
* Browse to http://localhost:1313/ to view the site locally
* Make code changes to the site
* Run `gulp` to recompile the site's assets (CSS, JS)
* Run `hugo` to rebuild the site, which render the site into the `/public` directory
* Commit the rebuilt site files to the `gh-pages` [branch](https://github.com/Azure/vscode-kubernetes-tools/tree/gh-pages/) of this repo to update the live site
