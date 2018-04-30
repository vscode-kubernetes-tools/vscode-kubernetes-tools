import * as vscode from 'vscode';

import * as assert from 'assert';
import * as textassert from './textassert';
import * as fakes from './fakes';

import { Host } from '../src/host';
import { Shell, ShellResult } from '../src/shell';
import { FS } from '../src/fs';
import { create as draftCreate, CheckPresentMode as DraftCheckPresentMode } from '../src/draft/draft';
import * as kuberesources from '../src/kuberesources';

interface FakeContext {
    host?: any;
    fs?: any;
    shell?: any;
}

function draftCreateWithFakes(ctx: FakeContext) {
    return draftCreate(
        ctx.host || fakes.host(),
        ctx.fs || fakes.fs(),
        ctx.shell || fakes.shell(),
        () => {}
    );
}

const draftFakePath = "c:\\fake\\draft\\draft.exe";

function draftFakePathConfig(): any {
    return { 'vs-kubernetes.draft-path': draftFakePath };
}

suite("draft tests", () => {

    suite("checkPresent method", () => {

        suite("If draft is not on the path", () => {

            test("...and configuration is not present, then checkPresent reports an error", async () => {
                let errors: string[] = [];
                const draft = draftCreateWithFakes({
                    host: fakes.host({errors: errors})
                });
                const present = await draft.checkPresent(DraftCheckPresentMode.Alert);
                assert.equal(false, present);
                assert.equal(errors.length, 1);
                textassert.startsWith('Could not find "draft" binary.', errors[0]);
            });

            test("...and configuration is present but file doesn't exist, then checkPresent reports an error", async () => {
                let errors: string[] = [];
                const draft = draftCreateWithFakes({
                    host: fakes.host({errors: errors, configuration: draftFakePathConfig()})
                });
                const present = await draft.checkPresent(DraftCheckPresentMode.Alert);
                assert.equal(false, present);
                assert.equal(errors.length, 1);
                textassert.startsWith('c:\\fake\\draft\\draft.exe does not exist!', errors[0]);
            });

            test("...and in silent mode, then no errors are reported", async () => {
                let errors: string[] = [];
                const draft = draftCreateWithFakes({
                    host: fakes.host({errors: errors})
                });
                const present = await draft.checkPresent(DraftCheckPresentMode.Silent);
                assert.equal(false, present);
                assert.equal(errors.length, 0);
            });

            test("...and configuration is present and file exists, then checkPresent does not report any messages", async () => {
                let errors = [];
                let warnings: string[] = [];
                let infos: string[] = [];
                const draft = draftCreateWithFakes({
                    host: fakes.host({errors: errors, warnings: warnings, infos: infos, configuration: draftFakePathConfig()}),
                    fs: fakes.fs({existentPaths: [draftFakePath]})
                });
                await draft.checkPresent(DraftCheckPresentMode.Alert);
                assert.equal(errors.length, 0);
                assert.equal(warnings.length, 0);
                assert.equal(infos.length, 0);
            });

            test("...and configuration is present and file exists, then checkPresent returns true", async () => {
                const draft = draftCreateWithFakes({
                    host: fakes.host({configuration: draftFakePathConfig()}),
                    fs: fakes.fs({existentPaths: [draftFakePath]})
                });
                const present = await draft.checkPresent(DraftCheckPresentMode.Alert);
                assert.equal(true, present);
            });

        });

        suite("If draft is on the path", () => {

            test("...no messages are reported on Windows", async () => {
                let errors: string[] = [];
                let warnings: string[] = [];
                let infos: string[] = [];
                const draft = draftCreateWithFakes({
                    host: fakes.host({errors: errors, warnings: warnings, infos: infos}),
                    shell: fakes.shell({recognisedCommands: [{command: 'where.exe draft.exe', code: 0, stdout: 'c:\\draft.exe'}]})
                });
                await draft.checkPresent(DraftCheckPresentMode.Alert);
                assert.equal(errors.length, 0);
                assert.equal(warnings.length, 0);
                assert.equal(infos.length, 0);
            });

            test("...no messages are reported on Unix", async () => {
                let errors: string[] = [];
                let warnings: string[] = [];
                let infos: string[] = [];
                const draft = draftCreateWithFakes({
                    host: fakes.host({errors: errors, warnings: warnings, infos: infos}),
                    shell: fakes.shell({isWindows: false, isUnix: true, recognisedCommands: [{command: 'which draft', code: 0, stdout: '/usr/bin/draft'}]})
                });
                await draft.checkPresent(DraftCheckPresentMode.Alert);
                assert.equal(errors.length, 0);
                assert.equal(warnings.length, 0);
                assert.equal(infos.length, 0);
            });

            test("...checkPresent returns true", async () => {
                const draft = draftCreateWithFakes({
                    shell: fakes.shell({recognisedCommands: [{command: 'where.exe draft.exe', code: 0, stdout: 'c:\\draft.exe'}]})
                });
                const present = await draft.checkPresent(DraftCheckPresentMode.Alert);
                assert.equal(true, present);
            });

        });

    });

    suite("isFolderMapped method", () => {

        test("If folder contains a draft.toml file and a .draftignore file, it is treated as already under draft control", () => {
            const draft = draftCreateWithFakes({
                fs: fakes.fs({
                    existentPaths: [
                        'c:\\dummy\\draft.toml',
                        'c:\\dummy\\server.js',
                        'c:\\dummy\\.draftignore',
                        'c:\\dummy\\dockerfile'
                    ]
                })
            });
            const isMapped = draft.isFolderMapped('c:\\dummy');
            assert.equal(isMapped, true);
        });

        test("If folder does not contain a draft.toml file, it is treated as not under draft control", () => {
            const draft = draftCreateWithFakes({
                fs: fakes.fs({
                    existentPaths: [
                        'c:\\dummy\\server.js',
                        'c:\\dummy\\.draftignore',
                        'c:\\dummy\\dockerfile'
                    ]
                })
            });
            const isMapped = draft.isFolderMapped('c:\\dummy');
            assert.equal(isMapped, false);
        });

        test("If folder does not contain a .draftignore file, it is treated as not under draft control", () => {
            const draft = draftCreateWithFakes({
                fs: fakes.fs({
                    existentPaths: [
                        'c:\\dummy\\draft.toml',
                        'c:\\dummy\\server.js',
                        'c:\\somewhere\\.draftignore',
                        'c:\\dummy\\dockerfile'
                    ]
                })
            });
            const isMapped = draft.isFolderMapped('c:\\dummy');
            assert.equal(isMapped, false);
        });

    });

    suite("packs method", () => {

        // This failure mode doesn't need to be more informative, because in practice
        // we check for presence before calling packs()
        test("If draft is not present, packs() returns nothing", async() => {
            const draft = draftCreateWithFakes({});
            const packs = await draft.packs();
            assert.equal(packs, undefined);
        });

        test("If draft home fails, packs() returns nothing", async() => {
            const draft = draftCreateWithFakes({
                shell: fakes.shell({recognisedCommands: [
                    {command: 'where.exe draft.exe', code: 0, stdout: 'c:\\draft.exe'},
                    {command: 'c:\\draft.exe home', code: 1, stderr: 'draft home failed'},
                ]})
            });
            const packs = await draft.packs();
            assert.equal(packs, undefined);
        });

        test("The packs subdirectory is scanned for entries", async() => {
            let probedPath = '';
            const draft = draftCreateWithFakes({
                shell: fakes.shell({recognisedCommands: [
                    {command: 'where.exe draft.exe', code: 0, stdout: 'c:\\draft.exe'},
                    {command: 'draft home', code: 0, stdout: 'c:\\itowlson\\.draft\n'},
                ]}),
                fs: fakes.fs({
                    onDirSync: (path) => { probedPath = path; return []; }
                })
            });
            const packs = await draft.packs();
            assert.equal(probedPath, 'c:\\itowlson\\.draft\\packs');
        });

        test("The entries in the packs subdirectory are returned", async() => {
            const draft = draftCreateWithFakes({
                shell: fakes.shell({recognisedCommands: [
                    {command: 'where.exe draft.exe', code: 0, stdout: 'c:\\draft.exe'},
                    {command: 'draft home', code: 0, stdout: 'c:\\itowlson\\.draft\n'},
                ]}),
                fs: fakes.fs({
                    onDirSync: (path) => [ 'ponylang', 'haskell', 'befunge' ]
                })
            });
            const packs = await draft.packs();
            assert.equal(packs.length, 3);
            assert.equal('ponylang', packs[0]);
            assert.equal('haskell', packs[1]);
            assert.equal('befunge', packs[2]);
        });

    });

});
