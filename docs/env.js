import { LoxError } from "./error.js";
import { panic } from "./util.js";
export class Environment {
    constructor(enclosing = null) {
        this.enclosing = enclosing;
        this.values = new Map;
    }
    define(arg0, value) {
        if (typeof arg0 === "string") {
            this.values.set(arg0, value);
        }
        else {
            this.values.set(arg0.name, arg0.value);
        }
    }
    assign(name, value) {
        if (this.values.has(name.lexeme)) {
            this.values.set(name.lexeme, value);
            return;
        }
        throw new LoxError(name.line, `Undefined variable '${name.lexeme}'`);
    }
    assignAt(depth, name, value) {
        const scope = this.ancestor(depth);
        if (scope.values.has(name.lexeme)) {
            scope.values.set(name.lexeme, value);
            return;
        }
        // should never hit because variables are statically resolved.
        panic(`Unresolved variable '${name.lexeme}'`);
    }
    get(name) {
        if (this.values.has(name.lexeme)) {
            const val = this.values.get(name.lexeme);
            if (val !== undefined)
                return val;
            throw new LoxError(name.line, `Uninitialized variable '${name.lexeme}'`);
        }
        throw new LoxError(name.line, `Undefined variable '${name.lexeme}'`);
    }
    getAt(depth, name) {
        const scope = this.ancestor(depth);
        if (scope.values.has(name.lexeme)) {
            const val = scope.values.get(name.lexeme);
            if (val !== undefined)
                return val;
            throw new LoxError(name.line, `Uninitialized variable '${name.lexeme}'`);
        }
        // should never hit because variables are statically resolved.
        panic(`Unresolved variable '${name.lexeme}'`);
    }
    getUncheckedAt(depth, name) {
        return this.ancestor(depth).values.get(name);
    }
    has(name) {
        return this.values.has(name);
    }
    hasAt(depth, name) {
        return this.ancestor(depth).values.has(name);
    }
    ancestor(depth) {
        let env = this;
        for (let i = 0; i < depth; ++i) {
            env = env.enclosing;
        }
        return env;
    }
}
