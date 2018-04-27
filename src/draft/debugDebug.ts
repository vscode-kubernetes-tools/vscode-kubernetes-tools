import * as vscode from 'vscode';
import { LoggingDebugSession, InitializedEvent, TerminatedEvent } from 'vscode-debugadapter';
import { EventEmitter } from 'events';
import { ChildProcess, exec } from 'child_process';
import { OutputChannel } from 'vscode';
import { Readable } from 'stream';
import { DraftRuntime } from './draftRuntime';
import { DebugProtocol } from 'vscode-debugprotocol/lib/debugProtocol';
const { Subject } = require('await-notify');


export class DraftDebugSession extends LoggingDebugSession {
    private _runtime: DraftRuntime;
    private _configurationDone = new Subject();

    public config: vscode.DebugConfiguration;

    constructor() {
        super("draft-debug.txt");
        this._runtime = new DraftRuntime();

        this._runtime.on('end', () => {
            this.sendEvent(new TerminatedEvent());
        });
    }

    protected initializeRequest(response: DebugProtocol.InitializeResponse, args: DebugProtocol.InitializeRequestArguments): void {
        this.sendResponse(response);
        this.sendEvent(new InitializedEvent());
    }

    protected configurationDoneRequest(response: DebugProtocol.ConfigurationDoneResponse, args: DebugProtocol.LaunchRequestArguments): void {
        this._configurationDone.notify();
    }

    protected async launchRequest(response: DebugProtocol.LaunchResponse, args: DebugProtocol.LaunchRequestArguments) {
        // wait until configuration has finished (and configurationDoneRequest has been called)
        await this._configurationDone.wait(1000);

        //start a `draft up` and `draft connect` session and attach debugger
        this._runtime.draftUpDebug(this.config);

        this.sendResponse(response);
    }

    protected evaluateRequest(response: DebugProtocol.EvaluateResponse, args: DebugProtocol.EvaluateArguments): void {
        if (args['restart'] == true) {
            // TODO - check for request type
            //
            // when a request is received (such as a file was saved), restart the Draft cycle
            this._runtime.killConnect();
            this._runtime.draftUpDebug(this.config);
        }

        if (args['stop'] == true) {
            this._runtime.killConnect();
            this.stop();
        }

        this.sendResponse(response);
    }
}
