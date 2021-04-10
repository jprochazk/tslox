import { LoxError } from "./error.js";
export class Context {
    constructor(logger) {
        this.logger = logger;
        this._hadError = false;
        this.errors = [];
    }
    get hadError() {
        return this._hadError;
    }
    reset() {
        this.errors = [];
        this._hadError = false;
    }
    reportAndReset() {
        for (let i = 0; i < this.errors.length; ++i) {
            this.logger.log(this.errors[i]);
        }
        this.errors = [];
        this._hadError = false;
    }
    error(arg0, message) {
        if (arg0 instanceof LoxError) {
            this.errors.push(`[line ${arg0.line}] ${trimStack(arg0.stack, 3)}`);
        }
        else {
            const token = arg0;
            if (token.type === 44 /* EOF */) {
                this.errors.push(`[line ${token.line}]: ${message}`);
            }
            else {
                this.errors.push(`[line ${token.line}]: ${message}`);
            }
        }
        this._hadError = true;
    }
}
function trimStack(stack, count) {
    const lines = [];
    for (const line of stack.split("\n")) {
        lines.push(line);
        if (lines.length === count)
            break;
    }
    return lines.join("\n");
}
