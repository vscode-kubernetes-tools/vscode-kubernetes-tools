## How to Release

To make a new release and publish it to the marketplace you have to follow the following steps.

1. Create a branch `publish-x.y.z`
2. Update `package.json` with the new version 
3. Add a section to `CHANGELOG.md` with the header `## [x.y.z]` (N.B: make sure to write the new version in square brackets as the `changelog-reader` action only works if the `CHANGELOG.md` file follows the [Keep a Changelog standard](https://github.com/olivierlacan/keep-a-changelog))
4. Create a new PR, get approval and merge
5. Run the `Build & Publish` workflow manually from the GH Actions tab

### Build & Publish 

The `Build & Publish` workflow allows to create a new release, package it in a VSIX file and publish to the VSCode marketplace with a single click.

The only requirement needed to run the workflow is to have a secret named `VS_MARKETPLACE_TOKEN` containing the Personal Access Token of the publisher. You can find more infos about how to create a publisher/token in the [official documentation](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#create-a-publisher)

Once everything is set up and you followed all first 4 steps in the previous section, you are ready to trigger the `Build & Publish` workflow.
This is what it actually does:

1. Install all dependencies and build the project
2. Check if the `CHANGELOG.md` contains a section related to the new version
3. Create a new release
4. Create the VSIX file and publish it to the marketplace
5. Attach the VSIX file to the new release