// import * as assert from 'assert';
// import * as textassert from './textassert';
// import * as fakes from './fakes';

// import { CheckPresentMessageMode, create as kubectlCreate } from '../src/kubectl';

// interface FakeContext {
//     host?: any;
//     fs?: any;
//     shell?: any;
// }

// function kubectlCreateWithFakes(ctx: FakeContext) {
//     return kubectlCreate(
//         ctx.host || fakes.host(),
//         ctx.fs || fakes.fs(),
//         ctx.shell || fakes.shell(),
//         () => {}
//     );
// }

// const kcFakePath = "c:\\fake\\kubectl\\kubectl.exe";

// function kcFakePathConfig(): any {
//     return { 'vs-kubernetes.kubectl-path': kcFakePath };
// }

// suite("kubectl tests", () => {

//     suite("checkPresent method", () => {

//         suite("If kubectl is not on the path", () => {

//             test("...and configuration is not present, then checkPresent fails", async () => {
//                 const kubectl = kubectlCreateWithFakes({});
//                 const present = await kubectl.checkPresent(CheckPresentMessageMode.Activation);
//                 assert.equal(present, false);
//             });

//             test("...and configuration is not present, then checkPresent reports an error", async () => {
//                 const errors: string[] = [];
//                 const kubectl = kubectlCreateWithFakes({
//                     host: fakes.host({errors: errors})
//                 });
//                 await kubectl.checkPresent(CheckPresentMessageMode.Activation);
//                 assert.equal(errors.length, 1);
//                 textassert.startsWith('Could not find "kubectl" binary.', errors[0]);
//             });

//             test("...the error message is appropriate for activation", async () => {
//                 const errors: string[] = [];
//                 const kubectl = kubectlCreateWithFakes({
//                     host: fakes.host({errors: errors})
//                 });
//                 await kubectl.checkPresent(CheckPresentMessageMode.Activation);
//                 assert.equal(errors.length, 1);
//                 textassert.includes('will not function correctly', errors[0]);
//             });

//             test("...the error message is appropriate for command invocation", async () => {
//                 const errors: string[] = [];
//                 const kubectl = kubectlCreateWithFakes({
//                     host: fakes.host({errors: errors})
//                 });
//                 await kubectl.checkPresent(CheckPresentMessageMode.Command);
//                 assert.equal(errors.length, 1);
//                 textassert.includes('Cannot execute command', errors[0]);
//             });

//             test("...and configuration is present but file doesn't exist, then checkPresent fails", async () => {
//                 const kubectl = kubectlCreateWithFakes({});
//                 const present = await kubectl.checkPresent(CheckPresentMessageMode.Activation);
//                 assert.equal(present, false);
//             });

//             test("...and configuration is present but file doesn't exist, then checkPresent reports an error", async () => {
//                 const errors: string[] = [];
//                 const kubectl = kubectlCreateWithFakes({
//                     host: fakes.host({errors: errors, configuration: kcFakePathConfig()})
//                 });
//                 await kubectl.checkPresent(CheckPresentMessageMode.Activation);
//                 assert.equal(errors.length, 1);
//                 textassert.startsWith('c:\\fake\\kubectl\\kubectl.exe does not exist!', errors[0]);
//             });

//             test("...and configuration is present and file exists, then checkPresent does not report any messages", async () => {
//                 const errors = [];
//                 const warnings: string[] = [];
//                 const infos: string[] = [];
//                 const kubectl = kubectlCreateWithFakes({
//                     host: fakes.host({errors: errors, warnings: warnings, infos: infos, configuration: kcFakePathConfig()}),
//                     fs: fakes.fs({existentPaths: [kcFakePath]})
//                 });
//                 await kubectl.checkPresent(CheckPresentMessageMode.Activation);
//                 assert.equal(errors.length, 0);
//                 assert.equal(warnings.length, 0);
//                 assert.equal(infos.length, 0);
//             });

//             test("...and configuration is present and file exists, then the callback is invoked", async () => {
//                 const kubectl = kubectlCreateWithFakes({
//                     host: fakes.host({configuration: kcFakePathConfig()}),
//                     fs: fakes.fs({existentPaths: [kcFakePath]})
//                 });
//                 const present = await kubectl.checkPresent(CheckPresentMessageMode.Activation);
//                 assert.equal(present, true);
//             });
//         });

//         suite("If kubectl is on the path", () => {

//             test("...checkPresent succeeds on Windows", async () => {
//                 const kubectl = kubectlCreateWithFakes({
//                     shell: fakes.shell({recognisedCommands: [{command: 'where.exe kubectl.exe', code: 0, stdout: 'c:\\kubectl.exe'}]})
//                 });
//                 const present = await kubectl.checkPresent(CheckPresentMessageMode.Activation);
//                 assert.equal(present, true);
//             });

//             test("...no messages are reported on Windows", async () => {
//                 const errors: string[] = [];
//                 const warnings: string[] = [];
//                 const infos: string[] = [];
//                 const kubectl = kubectlCreateWithFakes({
//                     host: fakes.host({errors: errors, warnings: warnings, infos: infos}),
//                     shell: fakes.shell({recognisedCommands: [{command: 'where.exe kubectl.exe', code: 0, stdout: 'c:\\kubectl.exe'}]})
//                 });
//                 await kubectl.checkPresent(CheckPresentMessageMode.Activation);
//                 assert.equal(errors.length, 0);
//                 assert.equal(warnings.length, 0);
//                 assert.equal(infos.length, 0);
//             });

//             test("...checkPresent succeeds on Unix", async () => {
//                 const kubectl = kubectlCreateWithFakes({
//                     shell: fakes.shell({isWindows: false, isUnix: true, recognisedCommands: [{command: 'which kubectl', code: 0, stdout: '/usr/bin/kubectl'}]})
//                 });
//                 const present = await kubectl.checkPresent(CheckPresentMessageMode.Activation);
//                 assert.equal(present, true);
//             });

//             test("...no messages are reported on Unix", async () => {
//                 const errors: string[] = [];
//                 const warnings: string[] = [];
//                 const infos: string[] = [];
//                 const kubectl = kubectlCreateWithFakes({
//                     host: fakes.host({errors: errors, warnings: warnings, infos: infos}),
//                     shell: fakes.shell({isWindows: false, isUnix: true, recognisedCommands: [{command: 'which kubectl', code: 0, stdout: '/usr/bin/kubectl'}]})
//                 });
//                 await kubectl.checkPresent(CheckPresentMessageMode.Activation);
//                 assert.equal(errors.length, 0);
//                 assert.equal(warnings.length, 0);
//                 assert.equal(infos.length, 0);
//             });

//         });

//     });

//     suite("invoke method", () => {

//         suite("If kubectl is not present", () => {

//             test("...checkPresent error handling is invoked", async () => {
//                 const errors: string[] = [];
//                 const kubectl = kubectlCreateWithFakes({
//                     host: fakes.host({errors: errors})
//                 });
//                 await kubectl.invoke('get', (code, stdout, stderr) => { throw 'should not have been called'; });
//                 assert.equal(errors.length, 1);
//                 textassert.startsWith('Could not find "kubectl" binary.', errors[0]);
//             });

//             test("...we do not attempt to call kubectl", async () => {
//                 let kubectlInvoked = false;
//                 const kubectl = kubectlCreateWithFakes({
//                     shell: fakes.shell({execCallback: (cmd) => {
//                         if (cmd.startsWith('kubectl')) { kubectlInvoked = true; }
//                         return { code: 98765, stdout: '', stderr: '' };
//                     } })
//                 });
//                 await kubectl.invoke('get', (code, stdout, stderr) => { throw 'should not have been called'; });
//                 assert.equal(kubectlInvoked, false);
//             });

//         });

//         suite("If kubectl is present", () => {

//             test("...we call it", async () => {
//                 let kubectlInvoked = false;
//                 const kubectl = kubectlCreateWithFakes({
//                     shell: fakes.shell({
//                         recognisedCommands: [{command: 'where.exe kubectl.exe', code: 0, stdout: 'c:\\kubectl.exe'}],
//                         execCallback: (cmd) => {
//                             if (cmd.startsWith('kubectl')) { kubectlInvoked = true; }
//                             return { code: 98765, stdout: '', stderr: '' };
//                         }
//                     })
//                 });
//                 await kubectl.invoke('get', (code, stdout, stderr) => { return; });
//                 assert.equal(kubectlInvoked, true);
//             });

//             test("...but not on the path, we call it using the full path", async () => {
//                 const invoked = [];
//                 const kubectl = kubectlCreateWithFakes({
//                     host: fakes.host({configuration: kcFakePathConfig()}),
//                     shell: fakes.shell({
//                         execCallback: (cmd) => {
//                             invoked.push(cmd);
//                             return { code: 98765, stdout: '', stderr: '' };
//                         }
//                     }),
//                     fs: fakes.fs({existentPaths: [kcFakePath]})
//                 });
//                 await kubectl.invoke('get', (code, stdout, stderr) => { return; });
//                 // TODO: replace with a collectionassert.exists
//                 const hasMatchingInvoke = invoked.indexOf(kcFakePath + " get") >= 0;
//                 assert.equal(hasMatchingInvoke, true);
//             });

//         });

//         suite("When we call kubectl", () => {

//             test("...we pass the right command and options", async () => {
//                 let kubectlCommandLine = '';
//                 const kubectl = kubectlCreateWithFakes({
//                     shell: fakes.shell({
//                         recognisedCommands: [{command: 'where.exe kubectl.exe', code: 0, stdout: 'c:\\kubectl.exe'}],
//                         execCallback: (cmd) => {
//                             if (cmd.startsWith('kubectl')) { kubectlCommandLine = cmd; }
//                             return { code: 98765, stdout: '', stderr: '' };
//                         }
//                     })
//                 });
//                 await kubectl.invoke('get --test deploy/helloworld', (code, stdout, stderr) => { return; });
//                 assert.equal(kubectlCommandLine, 'kubectl get --test deploy/helloworld');
//             });

//             test("...we pass the results of kubectl to the callback", async () => {
//                 const fakeKubectlResult = { code: 1, stdout: 'kubectl out', stderr: 'kubectl err' };
//                 let calledBackWith: any = { };
//                 const kubectl = kubectlCreateWithFakes({
//                     shell: fakes.shell({
//                         recognisedCommands: [{command: 'where.exe kubectl.exe', code: 0, stdout: 'c:\\kubectl.exe'}],
//                         execCallback: (cmd) => {
//                             if (cmd.startsWith('kubectl')) { return fakeKubectlResult; }
//                             return { code: 98765, stdout: '', stderr: '' };
//                         }
//                     })
//                 });
//                 await kubectl.invoke('get --test deploy/helloworld', (code, stdout, stderr) => { calledBackWith = { code: code, stdout: stdout, stderr: stderr }; });
//                 assert.equal(calledBackWith.code, fakeKubectlResult.code);
//                 assert.equal(calledBackWith.stdout, fakeKubectlResult.stdout);
//                 assert.equal(calledBackWith.stderr, fakeKubectlResult.stderr);
//             });

//             test("...if there is no callback, and kubectl succeeds, we show the kubectl output as info", async () => {
//                 const fakeKubectlResult = { code: 0, stdout: 'kubectl out', stderr: 'kubectl err' };
//                 const errors: string[] = [];
//                 const warnings: string[] = [];
//                 const infos: string[] = [];
//                 const kubectl = kubectlCreateWithFakes({
//                     host: fakes.host({errors: errors, warnings: warnings, infos: infos}),
//                     shell: fakes.shell({
//                         recognisedCommands: [{command: 'where.exe kubectl.exe', code: 0, stdout: 'c:\\kubectl.exe'}],
//                         execCallback: (cmd) => {
//                             if (cmd.startsWith('kubectl')) { return fakeKubectlResult; }
//                             return { code: 98765, stdout: '', stderr: '' };
//                         }
//                     })
//                 });
//                 await kubectl.invoke('get --test deploy/helloworld');
//                 assert.equal(errors.length, 0);
//                 assert.equal(warnings.length, 0);
//                 assert.equal(infos.length, 1);
//                 assert.equal(infos[0], fakeKubectlResult.stdout);
//             });

//             test("...if there is no callback, and kubectl fails, we show the kubectl error as error", async () => {
//                 const fakeKubectlResult = { code: 1, stdout: 'kubectl out', stderr: 'kubectl err' };
//                 const errors: string[] = [];
//                 const warnings: string[] = [];
//                 const infos: string[] = [];
//                 const kubectl = kubectlCreateWithFakes({
//                     host: fakes.host({errors: errors, warnings: warnings, infos: infos}),
//                     shell: fakes.shell({
//                         recognisedCommands: [{command: 'where.exe kubectl.exe', code: 0, stdout: 'c:\\kubectl.exe'}],
//                         execCallback: (cmd) => {
//                             if (cmd.startsWith('kubectl')) { return fakeKubectlResult; }
//                             return { code: 98765, stdout: '', stderr: '' };
//                         }
//                     })
//                 });
//                 await kubectl.invoke('get --test deploy/helloworld');
//                 assert.equal(errors.length, 1);
//                 assert.equal(warnings.length, 0);
//                 assert.equal(infos.length, 0);
//                 assert.equal(errors[0], "Kubectl command failed: " + fakeKubectlResult.stderr);
//             });

//         });

//     });

// });
