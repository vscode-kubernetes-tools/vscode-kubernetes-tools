export interface Advanceable {
    start(operationId: string) : void;
    next(request: UIRequest): Promise<void>;
}

export interface Errorable<T> {
    readonly succeeded: boolean;
    readonly result: T;
    readonly error: string[];
}

export interface UIRequest {
    readonly operationId: string;
    readonly requestData: string;
}

export interface StageData {
    readonly actionDescription: string;
    readonly result: Errorable<any>;
}

export interface OperationState<TStage> {
    readonly stage: TStage;
    readonly last: StageData;
}

export class OperationMap<TStage> {
    
        private operations: any = {};
    
        set(operationId: string, operationState: OperationState<TStage>) {
            this.operations[operationId] = operationState;
        }
    
        get(operationId: string) : OperationState<TStage> {
            return this.operations[operationId];
        }
    
    }
    