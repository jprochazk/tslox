
export class LoxError extends Error {
    constructor(
        readonly line: number,
        message: string
    ) {
        super(message);
    }
}