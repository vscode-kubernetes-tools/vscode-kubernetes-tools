import * as path from 'path';

import { runTests } from "@vscode/test-electron";


async function main() {
	try {
		// The folder containing the Extension Manifest package.json
		// Passed to `--extensionDevelopmentPath`
		const extensionDevelopmentPath = path.resolve(__dirname, '../../');

		// The path to test runner
		// Passed to --extensionTestsPath
		const extensionTestsPath = path.resolve(__dirname, './suite/index');

		// Opened as the workspace so that tests which need vscode.workspace.findFiles have
		// something to find. Tests that work on untitled documents are unaffected.
		const fixtureWorkspacePath = path.resolve(__dirname, '../../test/fixtures/kustomize');

		// Download VS Code, unzip it and run the integration test
		await runTests({ extensionDevelopmentPath, extensionTestsPath, version: "stable", launchArgs: [fixtureWorkspacePath] });
	} catch (err) {
		console.error(`Failed to run tests ${err}`);
		process.exit(1);
	}
}

main();
