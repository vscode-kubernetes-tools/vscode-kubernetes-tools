import { FS } from "../fs";

export class FileBacked<T> {
    private value: T | undefined;

    constructor(
        private readonly fs: FS,
        private readonly filename: string,
        private readonly defaultValue: () => T)
        {}

    async get(): Promise<T> {
        if (this.value) {
            return this.value;
        }
        if (await this.fs.existsAsync(this.filename)) {
            const text = await this.fs.readTextFile(this.filename);
            this.value = JSON.parse(text);
            return this.value!;
        }
        await this.update(this.defaultValue());
        return this.value!;
    }

    async update(value: T): Promise<void> {
        this.value = value;
        const text = JSON.stringify(this.value, undefined, 2);
        await this.fs.writeTextFile(this.filename, text);
    }
}
