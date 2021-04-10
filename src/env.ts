import { LoxError } from "./error";
import { Binding, Value } from "./interpreter";
import { Token } from "./lexer";
import { panic } from "./util";

export class Environment {
    private readonly values: Map<String, Value | undefined> = new Map;
    constructor(
        readonly enclosing: Environment | null = null
    ) { }

    define(binding: Binding): void;
    define(name: string, value?: Value): void;
    define(arg0: Binding | string, value?: Value): void {
        if (typeof arg0 === "string") {
            this.values.set(arg0, value);
        } else {
            this.values.set(arg0.name, arg0.value);
        }
    }

    assign(name: Token, value: Value): void {
        if (this.values.has(name.lexeme)) {
            this.values.set(name.lexeme, value);
            return;
        }

        throw new LoxError(name.line, `Undefined variable '${name.lexeme}'`);
    }

    assignAt(depth: number, name: Token, value: Value): void {
        const scope = this.ancestor(depth);
        if (scope.values.has(name.lexeme)) {
            scope.values.set(name.lexeme, value);
            return;
        }
        // should never hit because variables are statically resolved.
        panic(`Unresolved variable '${name.lexeme}'`);
    }

    get(name: Token): Value {
        if (this.values.has(name.lexeme)) {
            const val = this.values.get(name.lexeme);
            if (val !== undefined) return val;
            throw new LoxError(name.line, `Uninitialized variable '${name.lexeme}'`);
        }

        throw new LoxError(name.line, `Undefined variable '${name.lexeme}'`);
    }

    getAt(depth: number, name: Token): Value {
        const scope = this.ancestor(depth);
        if (scope.values.has(name.lexeme)) {
            const val = scope.values.get(name.lexeme);
            if (val !== undefined) return val;
            throw new LoxError(name.line, `Uninitialized variable '${name.lexeme}'`);
        }
        // should never hit because variables are statically resolved.
        panic(`Unresolved variable '${name.lexeme}'`);
    }

    getUncheckedAt(depth: number, name: string): Value {
        return this.ancestor(depth).values.get(name)!;
    }

    has(name: string): boolean {
        return this.values.has(name);
    }

    hasAt(depth: number, name: string): boolean {
        return this.ancestor(depth).values.has(name);
    }

    ancestor(depth: number): Environment {
        let env = this as Environment;
        for (let i = 0; i < depth; ++i) {
            env = env.enclosing!;
        }
        return env;
    }
}