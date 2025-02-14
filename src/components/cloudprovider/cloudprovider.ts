interface CloudProvider {
    getName(): string;
    isSignedIn(): Promise<boolean>;
    signIn(): Promise<boolean>;
    prerequisites(): Promise<string | undefined>;
    createCluster(inputs: any): Promise<void>;
}