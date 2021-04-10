export class LoxError extends Error {
    constructor(line, message) {
        super(message);
        this.line = line;
    }
}
