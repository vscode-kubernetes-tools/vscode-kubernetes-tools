import * as assert from 'assert';
import * as sinon from 'sinon';
import { platformArch } from "../../../../src/components/installer/installationlayout";

suite("Installation layout", () => {
    suite("platformArch method", () => {
        let sandbox: sinon.SinonSandbox;

        setup(() => {
            sandbox = sinon.createSandbox();
        });

        teardown(() => {
            sandbox.restore();
        });

        test("...arm and linux is arm", async () => {
            sandbox.stub(process, 'arch').value('arm');
            const platform = await platformArch('linux');
            assert.strictEqual(platform, 'arm');
        });

        test("...arm and darwin is amd64", async () => {
            sandbox.stub(process, 'arch').value('arm');
            const platform = await platformArch('darwin');
            assert.strictEqual(platform, 'amd64');
        });

        test("...arm and windows is amd64", async () => {
            sandbox.stub(process, 'arch').value('arm');
            const platform = await platformArch('windows');
            assert.strictEqual(platform, 'amd64');
        });

        test("...arm64 and linux is arm64", async () => {
            sandbox.stub(process, 'arch').value('arm64');
            const platform = await platformArch('linux');
            assert.strictEqual(platform, 'arm64');
        });

        test("...arm64 and darwin is arm64", async () => {
            sandbox.stub(process, 'arch').value('arm64');
            const platform = await platformArch('darwin');
            assert.strictEqual(platform, 'arm64');
        });

        test("...arm64 and windows is arm64", async () => {
            sandbox.stub(process, 'arch').value('arm64');
            const platform = await platformArch('windows');
            assert.strictEqual(platform, 'arm64');
        });

        test("...amd64 and linux is amd64", async () => {
            sandbox.stub(process, 'arch').value('amd64');
            const platform = await platformArch('linux');
            assert.strictEqual(platform, 'amd64');
        });

        test("...amd64 and darwin is amd64", async () => {
            sandbox.stub(process, 'arch').value('amd64');
            const platform = await platformArch('darwin');
            assert.strictEqual(platform, 'amd64');
        });

        test("...amd64 and windows is amd64", async () => {
            sandbox.stub(process, 'arch').value('amd64');
            const platform = await platformArch('windows');
            assert.strictEqual(platform, 'amd64');
        });

    });
});
