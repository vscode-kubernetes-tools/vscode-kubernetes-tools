import * as path from 'path';

import { downloadAndUnzipVSCode, runTests, runVSCodeCommand } from "@vscode/test-electron";


async function main() {
	try {
		// The folder containing the Extension Manifest package.json
		// Passed to `--extensionDevelopmentPath`
		const extensionDevelopmentPath = path.resolve(__dirname, '../../');

		// The path to test runner
		// Passed to --extensionTestsPath
		const extensionTestsPath = path.resolve(__dirname, './suite/index');

		// Allow pinning the VS Code version under test, e.g. VSCODE_TEST_VERSION=1.132.0.
		const version = process.env['VSCODE_TEST_VERSION'] || "stable";

		// Download VS Code and unzip it.
		const vscodeExecutablePath = await downloadAndUnzipVSCode(version);

		// Our `extensionDependencies` have to be present in the test instance, otherwise VS Code
		// refuses to activate us at all ("Cannot activate the 'Kubernetes' extension because it
		// depends on unknown extension 'redhat.vscode-yaml'").
		await runVSCodeCommand(['--install-extension', 'redhat.vscode-yaml', '--force'], { version });

		// Run the integration tests.
		await runTests({ vscodeExecutablePath, extensionDevelopmentPath, extensionTestsPath });
	} catch (err) {
		console.error(`Failed to run tests ${err}`);
		process.exit(1);
	}
}

main();
