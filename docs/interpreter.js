import { Environment } from "./env.js";
import { LoxError } from "./error.js";
export function type(value) {
    switch (true) {
        case typeof value === "boolean": return "boolean";
        case typeof value === "number": return "number";
        case typeof value === "string": return "string";
        case value === null: return "nil";
        case value._initializer !== undefined: return "class";
        case value.proto !== undefined: return "object";
        case value.arity !== undefined: return "func";
        default: return "unknown";
    }
}
export class ReturnValue {
    constructor(value) {
        this.value = value;
    }
}
export class FuncImpl {
    constructor(decl, closure, isInit) {
        this.decl = decl;
        this.closure = closure;
        this.isInit = isInit;
    }
    get isGetter() {
        return this.decl.params === null;
    }
    get arity() {
        return this.decl.params?.length ?? 0;
    }
    call(interpreter, args) {
        const env = new Environment(this.closure);
        if (this.decl.params) {
            for (let i = 0; i < this.decl.params.length; ++i) {
                env.define(this.decl.params[i].lexeme, args[i]);
            }
        }
        try {
            interpreter.executeBlock(this.decl.body, env);
        }
        catch (error) {
            if (error instanceof ReturnValue) {
                return error.value;
            }
            else {
                throw error;
            }
        }
        return null;
    }
    bind(instance) {
        const env = new Environment(this.closure);
        env.define("this", instance);
        return new FuncImpl(this.decl, env, this.isInit);
    }
    toString() {
        let kind = this.decl.params === null ? "getter" : "fn";
        return `<${kind} ${this.decl.name?.lexeme ?? "anonymous"}>`;
    }
}
export class ClassInstance {
    constructor(proto) {
        this.fields = new Map();
        if (proto)
            this.proto = proto;
    }
    get(name) {
        const value = this.fields.get(name.lexeme);
        if (value !== undefined)
            return value;
        const method = this.proto.findMethod(name.lexeme);
        if (method !== undefined)
            return method.bind(this);
        return null;
    }
    getOpt(name) {
        const value = this.fields.get(name.lexeme);
        if (value !== undefined)
            return value;
        const method = this.proto.findMethod(name.lexeme);
        if (method !== undefined)
            return method.bind(this);
    }
    set(name, value) {
        this.fields.set(name.lexeme, value);
        return value;
    }
    del(name) {
        return this.fields.delete(name.lexeme);
    }
    toString() {
        const properties = [];
        for (const [key, value] of this.fields.entries()) {
            properties.push(`${key}: ${stringify(value)}`);
        }
        for (const [key, value] of this.proto.methods.entries()) {
            // ignore methods that are shadowed by fields
            if (this.fields.has(key))
                continue;
            if (key === "init")
                continue;
            properties.push(`${key}: ${stringify(value)}`);
        }
        let sc = this.proto.superclass;
        while (sc) {
            for (const [key, value] of sc.methods.entries()) {
                if (this.fields.has(key))
                    continue;
                if (key === "init")
                    continue;
                properties.push(`${key}: ${stringify(value)}`);
            }
            sc = sc.superclass;
        }
        let shouldPad = properties.length > 0;
        return `${this.proto.name} {${shouldPad ? " " : ""}${properties.join(", ")}${shouldPad ? " " : ""}}`;
    }
}
export class ClassImpl extends ClassInstance {
    constructor(name, superclass, methods) {
        super(null);
        this.name = name;
        this.superclass = superclass;
        this.methods = methods;
        this._arity = 0;
        this._initializer = null;
        this.proto = this;
        const init = this.findMethod("init");
        if (init) {
            this._arity = init.arity;
            this._initializer = init;
            this.methods.delete("init");
        }
    }
    get isGetter() { return false; }
    ;
    get arity() {
        return this._arity;
    }
    findMethod(name) {
        return this.methods.get(name) ?? this.superclass?.findMethod(name);
    }
    getStatic(name) {
        const value = this.fields.get(name.lexeme) ?? this.superclass?.getStatic(name);
        if (value !== undefined)
            return value;
        return null;
    }
    getStaticOpt(name) {
        return this.fields.get(name.lexeme) ?? this.superclass?.getStaticOpt(name);
    }
    setStatic(name, value) {
        this.fields.set(name.lexeme, value);
        return value;
    }
    call(interpreter, args) {
        const instance = new ClassInstance(this);
        if (this._initializer !== null) {
            this._initializer.bind(instance).call(interpreter, args);
        }
        return instance;
    }
    toString() {
        return `<class ${this.name}>`;
    }
}
export class NativeFuncImpl {
    constructor(name, arity, isGetter, fn, instance = null) {
        this.name = name;
        this.arity = arity;
        this.isGetter = isGetter;
        this.fn = fn;
        this.instance = instance;
    }
    call(interpreter, args) {
        if (this.instance)
            this.fn.call(this.instance, interpreter, args);
        return this.fn(interpreter, args);
    }
    bind(instance) {
        return new NativeFuncImpl(this.name, this.arity, this.isGetter, this.fn, instance);
    }
    toString() {
        let kind = this.isGetter ? "getter" : "fn";
        return `<native ${kind} ${this.name}>`;
    }
}
export class NativeClassInstance {
    constructor(proto) {
        this.fields = new Map();
        if (proto)
            this.proto = proto;
    }
    get(name) {
        const value = this.fields.get(name.lexeme);
        if (value !== undefined)
            return value;
        const method = this.proto.findMethod(name.lexeme);
        if (method !== undefined)
            return method.bind(this);
        return null;
    }
    getOpt(name) {
        const value = this.fields.get(name.lexeme);
        if (value !== undefined)
            return value;
        const method = this.proto.findMethod(name.lexeme);
        if (method !== undefined)
            return method.bind(this);
    }
    set(name, value) {
        this.fields.set(name.lexeme, value);
        return value;
    }
    del(name) {
        return this.fields.delete(name.lexeme);
    }
    toString() {
        const properties = [];
        for (const [key, value] of this.fields.entries()) {
            properties.push(`${key}: ${stringify(value)}`);
        }
        for (const [key, value] of this.proto.methods.entries()) {
            // ignore methods that are shadowed by fields
            if (this.fields.has(key))
                continue;
            if (key === "init")
                continue;
            properties.push(`${key}: ${stringify(value)}`);
        }
        let shouldPad = properties.length > 0;
        return `${this.proto.name} {${shouldPad ? " " : ""}${properties.join(", ")}${shouldPad ? " " : ""}}`;
    }
}
export class NativeClassImpl extends NativeClassInstance {
    constructor(name, methods) {
        super(null);
        this.name = name;
        this.methods = methods;
        this._arity = 0;
        this._initializer = null;
        this.proto = this;
        const init = this.findMethod("init");
        if (init) {
            this._arity = init.arity;
            this._initializer = init;
            this.methods.delete("init");
        }
    }
    get isGetter() { return false; }
    get arity() {
        return this._arity;
    }
    findMethod(name) {
        return this.methods.get(name);
    }
    getStatic(name) {
        const value = this.fields.get(name.lexeme);
        if (value !== undefined)
            return value;
        return null;
    }
    getStaticOpt(name) {
        return this.fields.get(name.lexeme);
    }
    setStatic(name, value) {
        this.fields.set(name.lexeme, value);
        return value;
    }
    call(interpreter, args) {
        const instance = new NativeClassInstance(this);
        if (this._initializer !== null) {
            this._initializer.bind(instance).call(interpreter, args);
        }
        return instance;
    }
    toString() {
        return `<class ${this.name}>`;
    }
}
export function makefn(name, arity, call) {
    return {
        name: name,
        value: new NativeFuncImpl(name, arity, false, call)
    };
}
;
export function makeclass(name, methods = {}, staticMethods = {}) {
    const nativeMethods = new Map();
    const methodNames = Object.keys(methods);
    for (let i = 0; i < methodNames.length; ++i) {
        const name = methodNames[i];
        const method = methods[name];
        if (method.isGetter && method.call.length !== 0) {
            throw new Error(`Getter arity must be 0 at method '${name}'`);
        }
        nativeMethods.set(name, new NativeFuncImpl(name, method.call.length, method.isGetter, method.call));
    }
    const impl = new NativeClassImpl(name, nativeMethods);
    const staticMethodNames = Object.keys(staticMethods);
    for (let i = 0; i < staticMethodNames.length; ++i) {
        const name = staticMethodNames[i];
        const method = staticMethods[name];
        impl.fields.set(name, new NativeFuncImpl(name, method.call.length, false, method.call));
    }
    return {
        name,
        value: impl
    };
}
export class Interpreter {
    constructor(ctx) {
        this.ctx = ctx;
        this.globals = new Environment;
        this.env = this.globals;
        this.locals = new Map();
        this.globals.define(makefn("type", 1, (_, [v]) => type(v)));
        this.globals.define(makefn("time", 0, () => Date.now()));
        this.globals.define(makefn("str", 1, (_, [v]) => stringify(v)));
    }
    interpret(stmtList) {
        try {
            for (let i = 0; i < stmtList.length; ++i) {
                this.execute(stmtList[i]);
            }
        }
        catch (error) {
            if (error instanceof LoxError) {
                this.ctx.error(error);
            }
            else {
                throw error;
            }
        }
    }
    resolve(expr, depth) {
        this.locals.set(expr, depth);
    }
    lookup(name, expr) {
        const distance = this.locals.get(expr);
        if (distance !== undefined) {
            return this.env.getAt(distance, name);
        }
        else {
            return this.globals.get(name);
        }
    }
    execute(stmt) {
        stmt.accept(this);
    }
    executeBlock(stmtList, env) {
        const prevEnv = this.env;
        try {
            this.env = env;
            for (let i = 0; i < stmtList.length; ++i) {
                this.execute(stmtList[i]);
            }
        }
        finally {
            this.env = prevEnv;
        }
    }
    visitIfStmt(stmt) {
        if (isTruthy(this.evaluate(stmt.condition))) {
            this.execute(stmt.thenBranch);
        }
        else {
            if (stmt.elseBranch)
                this.execute(stmt.elseBranch);
        }
    }
    visitExpressionStmt(stmt) {
        this.evaluate(stmt.expr);
    }
    visitPrintStmt(stmt) {
        if (stmt.expr.type === 7 /* Comma */) {
            let parts = [];
            for (let i = 0, len = stmt.expr.list.length; i < len; ++i) {
                parts.push(stringify(this.evaluate(stmt.expr.list[i])));
            }
            this.ctx.logger.log(join(parts, " "));
        }
        else {
            const value = this.evaluate(stmt.expr);
            this.ctx.logger.log(stringify(value));
        }
    }
    visitLoopStmt(stmt) {
        const prevEnv = this.env;
        this.env = new Environment(this.env);
        if (stmt.init)
            this.execute(stmt.init);
        loop: while (isTruthy(this.evaluate(stmt.condition))) {
            try {
                this.execute(stmt.body);
                if (stmt.update)
                    this.evaluate(stmt.update);
            }
            catch (error) {
                switch (error) {
                    case 0 /* Break */:
                        break loop;
                    case 1 /* Continue */:
                        if (stmt.update)
                            this.evaluate(stmt.update);
                        continue loop;
                    default: throw error;
                }
            }
        }
        this.env = prevEnv;
    }
    visitBreakStmt(_stmt) {
        throw 0 /* Break */;
    }
    visitContinueStmt(_stmt) {
        throw 1 /* Continue */;
    }
    visitVarStmt(stmt) {
        let value = undefined;
        if (stmt.init) {
            value = this.evaluate(stmt.init);
        }
        this.env.define(stmt.name.lexeme, value);
    }
    visitBlockStmt(stmt) {
        this.executeBlock(stmt.stmtList, new Environment(this.env));
    }
    visitFunctionStmt(stmt) {
        this.env.define(stmt.name.lexeme, new FuncImpl(stmt, this.env, false));
    }
    visitReturnStmt(stmt) {
        let value = null;
        if (stmt.value !== null)
            value = this.evaluate(stmt.value);
        throw new ReturnValue(value);
    }
    visitClassStmt(stmt) {
        let superclass = null;
        if (stmt.superclass !== null) {
            const impl = this.evaluate(stmt.superclass);
            if (type(impl) !== "class") {
                throw new LoxError(stmt.superclass.name.line, "Superclass must be a class");
            }
            superclass = impl;
        }
        this.env.define(stmt.name.lexeme, null);
        if (superclass !== null) {
            this.env = new Environment(this.env);
            this.env.define("super", superclass);
        }
        const methods = new Map();
        for (let i = 0; i < stmt.methods.length; ++i) {
            const method = stmt.methods[i];
            methods.set(method.name.lexeme, new FuncImpl(method, this.env, method.name.lexeme === "init"));
        }
        const impl = new ClassImpl(stmt.name.lexeme, superclass, methods);
        for (let i = 0; i < stmt.staticMethods.length; ++i) {
            const method = stmt.staticMethods[i];
            impl.set(method.name, new FuncImpl(method, this.env, false));
        }
        if (superclass !== null) {
            this.env = this.env.enclosing;
        }
        this.env.assign(stmt.name, impl);
    }
    evaluate(expr) {
        return expr.accept(this);
    }
    visitAssignExpr(expr) {
        const value = this.evaluate(expr.value);
        const depth = this.locals.get(expr);
        if (depth !== undefined) {
            this.env.assignAt(depth, expr.name, value);
        }
        else {
            this.globals.assign(expr.name, value);
        }
        return value;
    }
    visitVariableExpr(expr) {
        return this.lookup(expr.name, expr);
    }
    visitUnaryExpr(expr) {
        const right = this.evaluate(expr.right);
        switch (expr.op.type) {
            case 12 /* BANG */:
                return !isTruthy(right);
            case 6 /* MINUS */:
                assertType(right, "number", "Operand must be a number", expr.op.line);
                return -right;
        }
        return null;
    }
    visitGroupingExpr(expr) {
        return this.evaluate(expr.inner);
    }
    visitLiteralExpr(expr) {
        return expr.value;
    }
    visitBinaryExpr(expr) {
        const left = this.evaluate(expr.left);
        const right = this.evaluate(expr.right);
        switch (expr.op.type) {
            case 13 /* BANG_EQUAL */:
                return !isEqual(left, right);
            case 15 /* EQUAL_EQUAL */:
                return isEqual(left, right);
            case 16 /* GREATER */:
                assertType(left, "number", "Operand must be a number", expr.op.line);
                assertType(right, "number", "Operand must be a number", expr.op.line);
                return left > right;
            case 17 /* GREATER_EQUAL */:
                assertType(left, "number", "Operand must be a number", expr.op.line);
                assertType(right, "number", "Operand must be a number", expr.op.line);
                return left >= right;
            case 18 /* LESS */:
                assertType(left, "number", "Operand must be a number", expr.op.line);
                assertType(right, "number", "Operand must be a number", expr.op.line);
                return left < right;
            case 19 /* LESS_EQUAL */:
                assertType(left, "number", "Operand must be a number", expr.op.line);
                assertType(right, "number", "Operand must be a number", expr.op.line);
                return left <= right;
            case 6 /* MINUS */:
                assertType(left, "number", "Operand must be a number", expr.op.line);
                assertType(right, "number", "Operand must be a number", expr.op.line);
                return left - right;
            case 7 /* PLUS */:
                if (typeof left === "number" && typeof right === "number") {
                    return left + right;
                }
                if (typeof left === "string" && typeof right === "string") {
                    return left + right;
                }
                throw new LoxError(expr.op.line, "Operands must both be a number or a string");
            case 9 /* SLASH */:
                assertType(left, "number", "Operand must be a number", expr.op.line);
                assertType(right, "number", "Operand must be a number", expr.op.line);
                return left / right;
            case 10 /* STAR */:
                assertType(left, "number", "Operand must be a number", expr.op.line);
                assertType(right, "number", "Operand must be a number", expr.op.line);
                return left * right;
            case 11 /* PERCENT */:
                assertType(left, "number", "Operand must be a number", expr.op.line);
                assertType(right, "number", "Operand must be a number", expr.op.line);
                return left % right;
            case 20 /* POWER */:
                assertType(left, "number", "Operand must be a number", expr.op.line);
                assertType(right, "number", "Operand must be a number", expr.op.line);
                return left ** right;
        }
        return null;
    }
    visitLogicalExpr(expr) {
        const left = this.evaluate(expr.left);
        if (expr.op.type === 32 /* OR */) {
            if (isTruthy(left))
                return left;
        }
        else {
            if (!isTruthy(left))
                return left;
        }
        return this.evaluate(expr.right);
    }
    visitCommaExpr(expr) {
        // everything but the last operand are side-effects
        let val = this.evaluate(expr.list[0]);
        for (let i = 1; i < expr.list.length; ++i) {
            val = this.evaluate(expr.list[i]);
        }
        return val;
    }
    visitCallExpr(expr) {
        const callee = this.evaluate(expr.callee);
        const args = [];
        for (let i = 0; i < expr.args.length; ++i) {
            args.push(this.evaluate(expr.args[i]));
        }
        if (callee === null || callee.call == null || callee.arity == null) {
            throw new LoxError(expr.end.line, "Value is not callable");
        }
        const fn = callee;
        if (args.length !== fn.arity) {
            throw new LoxError(expr.end.line, `Expected ${fn.arity} args but got ${args.length}`);
        }
        return callee.call(this, args);
    }
    visitFunctionExpr(expr) {
        return new FuncImpl(expr, this.env, false);
    }
    visitGetExpr(expr) {
        const object = this.evaluate(expr.object);
        const t = type(object);
        if (t === "object") {
            const prop = object.get(expr.name);
            if (type(prop) === "func" && prop.isGetter) {
                return prop.call(this, []);
            }
            return prop;
        }
        if (t === "class") {
            return object.getStatic(expr.name);
        }
        throw new LoxError(expr.name.line, "Value is not a class instance");
    }
    visitSetExpr(expr) {
        const object = this.evaluate(expr.object);
        const t = type(object);
        if (t === "object") {
            const value = this.evaluate(expr.value);
            return object.set(expr.name, value);
        }
        if (t === "class") {
            const value = this.evaluate(expr.value);
            return object.setStatic(expr.name, value);
        }
        throw new LoxError(expr.name.line, "Value is not a class instance");
    }
    visitDeleteExpr(expr) {
        const object = this.evaluate(expr.object);
        const t = type(object);
        if (t === "object" || t === "class") {
            return object.del(expr.name);
        }
        throw new LoxError(expr.name.line, "Value is not a class instance");
    }
    visitThisExpr(expr) {
        return this.lookup(expr.keyword, expr);
    }
    visitSuperExpr(expr) {
        const depth = this.locals.get(expr);
        const superclass = this.env.getUncheckedAt(depth, "super");
        const object = this.env.getUncheckedAt(depth - 1, "this");
        if (object === undefined) {
            // static context
            const value = superclass.getStaticOpt(expr.value) ?? null;
            return value;
        }
        else {
            // instance context
            const value = superclass.getOpt(expr.value) ?? null;
            if (type(value) === "func") {
                return value.bind(object);
            }
            return value;
        }
    }
}
function isTruthy(value) {
    if (value === null)
        return false;
    if (typeof value === "boolean")
        return value;
    return true;
}
function isEqual(left, right) {
    if (left === null) {
        if (right === null)
            return true;
        return false;
    }
    return left === right;
}
function assertType(value, expected, message, line) {
    let actual = typeof value;
    if (value === null)
        actual = "null";
    if (actual !== expected) {
        throw new LoxError(line, message);
    }
}
function join(arr, sep) {
    let out = "";
    const end = arr.length - 1;
    for (let i = 0; i < end; ++i) {
        out += arr[i] + sep;
    }
    out += arr[end];
    return out;
}
export function stringify(value) {
    if (value === null)
        return "nil";
    if (value === Infinity)
        return "inf";
    return value.toString();
}
