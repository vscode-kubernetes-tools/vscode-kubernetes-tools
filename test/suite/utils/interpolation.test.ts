import * as assert from 'assert';
import * as sinon from 'sinon';
import { interpolateVariables } from "../../../src/utils/interpolation";
import * as vscode from 'vscode';

suite("Interpolate Vscode variables", () => {
    test("return empty string if trying to interpolate empty string", () => {
        const result = interpolateVariables("");
        assert.strictEqual(result, "");
    });

    test("return undefined value if trying to interpolate an undefined value", () => {
        const result = interpolateVariables(undefined);
        assert.strictEqual(result, undefined);
    });

    // TODO: Refactor 'interpolateVariables' to allow us to pass the 'os.homedir' value to it.
    // Attempting to stub this previously failed silently, but now throws:
    // https://github.com/sinonjs/sinon/issues/2377
    // test("replace userHome variable with actual home dir value", () => {
    //     sinon.stub(os, "homedir").returns('home');
    //     const result = interpolateVariables("${userHome}/folder");
    //     assert.strictEqual(result, "home/folder");
    // });

    test("replace workspaceFolder variable with actual workspaceFolder path", () => {
        const workspaceFolder: vscode.WorkspaceFolder = {
            uri: vscode.Uri.parse("workspace_path"),
            name: '',
            index: 0
        }
        sinon.stub(vscode.workspace, "workspaceFolders").value([workspaceFolder]);
        const result = interpolateVariables("${workspaceFolder}/file");
        sinon.assert.match(result && result.includes("workspace_path/file"), true);
    });

    test("replace env variable with the value of the environment variable", () => {
        process.env.K8S_TOOLS_INTERPOLATION_TEST = "/opt/tools";
        try {
            const result = interpolateVariables("${env:K8S_TOOLS_INTERPOLATION_TEST}/kubectl");
            assert.strictEqual(result, "/opt/tools/kubectl");
        } finally {
            delete process.env.K8S_TOOLS_INTERPOLATION_TEST;
        }
    });

    test("replace config variable with the value of the named setting", () => {
        const getConfiguration = sinon.stub(vscode.workspace, "getConfiguration");
        try {
            getConfiguration.returns({
                get: (section: string, defaultValue?: string) => section === "my.tools.dir" ? "/opt/tools" : defaultValue
            } as unknown as vscode.WorkspaceConfiguration);
            const result = interpolateVariables("${config:my.tools.dir}/kubectl");
            assert.strictEqual(result, "/opt/tools/kubectl");
        } finally {
            getConfiguration.restore();
        }
    });

});