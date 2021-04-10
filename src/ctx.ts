import { LoxError } from "./error";
import { Token } from "./lexer";

export class Context {
    private _hadError = false;
    public errors: string[] = [];

    get hadError(): boolean {
        return this._hadError;
    }

    reset() {
        this.errors = [];
        this._hadError = false;
    }

    reportAndReset() {
        for (let i = 0; i < this.errors.length; ++i) {
            console.log(this.errors[i]);
        }
        this.errors = [];
        this._hadError = false;
    }

    error(error: LoxError): void;
    error(token: Token, message: string): void;
    error(arg0: LoxError | Token, message?: string): void {
        if (arg0 instanceof LoxError) {
            this.errors.push(`[line ${arg0.line}] ${trimStack(arg0.stack!, 3)}`);
        } else {
            const token = arg0;
            if (token.type === Token.Type.EOF) {
                this.errors.push(`[line ${token.line}]: ${message}`);
            } else {
                this.errors.push(`[line ${token.line}]: ${message}`)
            }
        }
        this._hadError = true;
    }
}

function trimStack(stack: string, count: number) {
    const lines = [];
    for (const line of stack.split("\n")) {
        lines.push(line);
        if (lines.length === count) break;
    }
    return lines.join("\n");
}