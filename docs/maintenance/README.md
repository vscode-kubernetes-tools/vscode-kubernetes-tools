## How to Release

To make a new release and publish it to the Marketplace, follow these steps.

1. Create a branch `publish-x.y.z`.
2. Update `package.json` and `package-lock.json` with the new version.
3. Add a section to `CHANGELOG.md` with the header `## [x.y.z]`. Keep the version
   in square brackets so the `changelog-reader` action can read the release notes.
4. Create a PR, get approval, pass CI, and merge into `main`.
5. Run the Azure DevOps release pipeline manually.
6. After Marketplace publication succeeds, run the `Create GitHub Release`
   workflow as described below.

### Build & Publish

The [Azure DevOps release pipeline](../../.pipelines/1es-pipeline.yml) builds,
signs, and publishes the extension to the Visual Studio Marketplace.

Before running it, configure the non-secret Azure DevOps pipeline variable
`AZURE_ARTIFACTS_FEED` with the full npm registry URL of a CFS-enabled Azure
Artifacts feed in the pipeline's organization, ending in `/npm/registry/`.
The feed must have npmjs upstream enabled, and the pipeline's build identity must
have the Feed and Upstream Reader (Collaborator) role to restore packages from
upstream. The pipeline authenticates the feed before installing dependencies;
no private feed configuration needs to be committed to this repository.

When starting the pipeline, set `publishVersion` to the version in `package.json`,
without a `v` prefix. Select the approved commit for the `vscode-kubernetes-tools`
repository resource, which defaults to upstream `main`, and confirm that CI has
passed for that commit.

This is what the pipeline does:

1. Install dependencies, lint, and compile the project.
2. Check that `publishVersion` matches `package.json`.
3. Create the VSIX file and generate its manifest.
4. Sign the manifest and publish the extension to the Marketplace.
5. Save the VSIX, manifest, and signature in the `vscode-extension-signed` artifact.

Once the pipeline succeeds, confirm the version is available on Marketplace.
Record the run URL and source checkout commit. The signed release files remain
available in the `vscode-extension-signed` artifact.

### Create GitHub Release

The [Create GitHub Release workflow](../../.github/workflows/main.yml) creates the
GitHub release separately. It is not started automatically by the Azure DevOps
pipeline.

First, create the version tag at the source commit used by the successful Azure
DevOps run, then start the workflow from that tag. Using the GitHub CLI, replace
the example values below:

```bash
VERSION="x.y.z"
SOURCE_COMMIT="full-source-commit-sha-from-the-azure-checkout"
REPOSITORY="vscode-kubernetes-tools/vscode-kubernetes-tools"

gh api --method POST "repos/$REPOSITORY/git/refs" \
  -f "ref=refs/tags/$VERSION" \
  -f "sha=$SOURCE_COMMIT"

gh workflow run main.yml --repo "$REPOSITORY" --ref "$VERSION"
```

If the tag already exists, check that it points to the same source commit before
running the workflow. Do not move an existing release tag or run from a newer
`main`. The tagged commit must contain the release workflow.

This is what the workflow does:

1. Read the version from `package.json`.
2. Read the matching section in `CHANGELOG.md`.
3. Create a published GitHub release with that version and release notes.

The workflow does not rebuild the extension or publish to Marketplace. No VSIX,
manifest, or signature needs to be attached to the GitHub release. Install the
released extension from the Visual Studio Marketplace.

The separate [Development build workflow](../../.github/workflows/build-dev.yml)
packages a VSIX on pushes to `main` and saves it as an Actions artifact named
`vsix`. This is a development build, not a GitHub release asset.

If the GitHub step fails, retry only that step using the same source commit; do
not republish to Marketplace.