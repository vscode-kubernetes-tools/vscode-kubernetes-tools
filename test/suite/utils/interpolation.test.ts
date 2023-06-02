import * as assert from 'assert';
import * as sinon from 'sinon';
import * as os from 'os';
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

    test("replace userHome variable with actual home dir value", () => {
        sinon.stub(os, "homedir").returns('home');
        const result = interpolateVariables("${userHome}/folder");
        assert.strictEqual(result, "home/folder");
    });

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

});