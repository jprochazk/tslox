import { Context } from "./ctx";
import { Token } from "./lexer";
import * as Ast from "./ast";
import { Environment } from "./env";
import { LoxError } from "./error";

type func = FuncImpl | NativeFuncImpl;
type instance = ClassInstance | NativeClassInstance;
type impl = ClassImpl | NativeClassImpl;

export type Value =
    | object
    | boolean
    | number
    | string
    | null
    | func
    ;

export type ValueType =
    | "boolean"
    | "number"
    | "string"
    | "nil"
    | "func"
    | "class" // ClassImpl-like
    | "object" // ClassInstance-like
    | "unknown"
    ;

export function type(value: Value): ValueType {
    switch (true) {
        case typeof value === "boolean": return "boolean";
        case typeof value === "number": return "number";
        case typeof value === "string": return "string";
        case value === null: return "nil";
        case (<any>value)._initializer !== undefined: return "class";
        case (<any>value).proto !== undefined: return "object";
        case (<any>value).arity !== undefined: return "func";
        default: return "unknown";
    }
}

const enum Signal {
    Break,
    Continue
}

export class ReturnValue {
    constructor(public value: Value) { }
}

export class FuncImpl {
    constructor(
        readonly decl: Ast.Stmt.Function | Ast.Expr.Function,
        readonly closure: Environment,
        readonly isInit: boolean
    ) { }

    get isGetter() {
        return this.decl.params === null;
    }

    get arity() {
        return this.decl.params?.length ?? 0;
    }

    call(interpreter: Interpreter, args: Value[]): Value {
        const env = new Environment(this.closure);
        if (this.decl.params) {
            for (let i = 0; i < this.decl.params.length; ++i) {
                env.define(this.decl.params[i].lexeme, args[i]);
            }
        }

        try {
            interpreter.executeBlock(this.decl.body, env);
        } catch (error: unknown) {
            if (error instanceof ReturnValue) {
                return error.value;
            } else {
                throw error;
            }
        }
        return null;
    }

    bind(instance: ClassInstance) {
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
    readonly fields = new Map<string, Value>();
    readonly proto!: ClassImpl;
    constructor(
        proto: ClassImpl | null
    ) {
        if (proto) this.proto = proto;
    }

    get(name: Token): Value {
        const value = this.fields.get(name.lexeme);
        if (value !== undefined) return value;

        const method = this.proto.findMethod(name.lexeme);
        if (method !== undefined) return method.bind(this);

        throw new LoxError(name.line, `Undefined property '${name.lexeme}'`);
    }

    getOpt(name: Token): Value | undefined {
        const value = this.fields.get(name.lexeme);
        if (value !== undefined) return value;

        const method = this.proto.findMethod(name.lexeme);
        if (method !== undefined) return method.bind(this);
    }

    set(name: Token, value: Value): Value {
        this.fields.set(name.lexeme, value);
        return value;
    }

    del(name: Token): boolean {
        return this.fields.delete(name.lexeme);
    }

    toString() {
        const properties = [];
        for (const [key, value] of this.fields.entries()) {
            properties.push(`${key}: ${stringify(value)}`);
        }
        for (const [key, value] of this.proto.methods.entries()) {
            // ignore methods that are shadowed by fields
            if (this.fields.has(key)) continue;
            if (key === "init") continue;
            properties.push(`${key}: ${stringify(value)}`);
        }
        let sc = this.proto.superclass
        while (sc) {
            for (const [key, value] of sc.methods.entries()) {
                if (this.fields.has(key)) continue;
                if (key === "init") continue;
                properties.push(`${key}: ${stringify(value)}`);
            }
            sc = sc.superclass;
        }
        let shouldPad = properties.length > 0;
        return `${this.proto.name} {${shouldPad ? " " : ""}${properties.join(", ")}${shouldPad ? " " : ""}}`;
    }
}

export class ClassImpl extends ClassInstance {
    private _arity: number = 0;
    private _initializer: FuncImpl | null = null;
    constructor(
        readonly name: string,
        readonly superclass: ClassImpl | null,
        readonly methods: Map<string, FuncImpl>,
    ) {
        super(null);
        (<ClassImpl>this.proto) = this;
        const init = this.findMethod("init");
        if (init) {
            this._arity = init.arity;
            this._initializer = init;
            this.methods.delete("init");
        }
    }

    get isGetter() { return false };

    get arity(): number {
        return this._arity;
    }

    findMethod(name: string): FuncImpl | undefined {
        return this.methods.get(name) ?? this.superclass?.findMethod(name);
    }

    getStatic(name: Token): Value {
        const value = this.fields.get(name.lexeme) ?? this.superclass?.getStatic(name);
        if (value !== undefined) return value;

        throw new LoxError(name.line, `Undefined property '${name.lexeme}'`);
    }

    getStaticOpt(name: Token): Value | undefined {
        return this.fields.get(name.lexeme) ?? this.superclass?.getStaticOpt(name);
    }

    setStatic(name: Token, value: Value): Value {
        this.fields.set(name.lexeme, value);
        return value;
    }

    call(interpreter: Interpreter, args: Value[]): Value {
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
    constructor(
        readonly name: string,
        readonly arity: number,
        readonly isGetter: boolean,
        readonly fn: (interpreter: Interpreter, args: Value[]) => Value,
        private instance: NativeClassInstance | null = null,
    ) { }

    call(interpreter: Interpreter, args: Value[]): Value {
        if (this.instance) this.fn.call(this.instance, interpreter, args);
        return this.fn(interpreter, args);
    }

    bind(instance: NativeClassInstance): NativeFuncImpl {
        return new NativeFuncImpl(this.name, this.arity, this.isGetter, this.fn, instance);
    }

    toString() {
        let kind = this.isGetter ? "getter" : "fn";
        return `<native ${kind} ${this.name}>`;
    }
}

export class NativeClassInstance {
    readonly fields = new Map<string, Value>();
    readonly proto!: NativeClassImpl;
    constructor(
        proto: NativeClassImpl | null
    ) {
        if (proto) this.proto = proto;
    }

    get(name: Token): Value {
        const value = this.fields.get(name.lexeme);
        if (value !== undefined) return value;

        const method = this.proto.findMethod(name.lexeme);
        if (method !== undefined) return method.bind(this);

        throw new LoxError(name.line, `Undefined property '${name.lexeme}'`);
    }

    getOpt(name: Token): Value | undefined {
        const value = this.fields.get(name.lexeme);
        if (value !== undefined) return value;

        const method = this.proto.findMethod(name.lexeme);
        if (method !== undefined) return method.bind(this);
    }

    set(name: Token, value: Value): Value {
        this.fields.set(name.lexeme, value);
        return value;
    }

    del(name: Token): boolean {
        return this.fields.delete(name.lexeme);
    }

    toString() {
        const properties = [];
        for (const [key, value] of this.fields.entries()) {
            properties.push(`${key}: ${stringify(value)}`);
        }
        for (const [key, value] of this.proto.methods.entries()) {
            // ignore methods that are shadowed by fields
            if (this.fields.has(key)) continue;
            if (key === "init") continue;
            properties.push(`${key}: ${stringify(value)}`);
        }
        let shouldPad = properties.length > 0;
        return `${this.proto.name} {${shouldPad ? " " : ""}${properties.join(", ")}${shouldPad ? " " : ""}}`;
    }
}

export class NativeClassImpl extends NativeClassInstance {
    private _arity: number = 0;
    private _initializer: NativeFuncImpl | null = null;
    constructor(
        readonly name: string,
        readonly methods: Map<string, NativeFuncImpl>,
    ) {
        super(null);
        (<NativeClassImpl>this.proto) = this;
        const init = this.findMethod("init");
        if (init) {
            this._arity = init.arity;
            this._initializer = init;
            this.methods.delete("init");
        }
    }

    get isGetter() { return false }

    get arity(): number {
        return this._arity;
    }

    findMethod(name: string) {
        return this.methods.get(name);
    }

    getStatic(name: Token): Value {
        const value = this.fields.get(name.lexeme);
        if (value !== undefined) return value;

        throw new LoxError(name.line, `Undefined property '${name.lexeme}'`);
    }

    getStaticOpt(name: Token): Value | undefined {
        return this.fields.get(name.lexeme);
    }

    setStatic(name: Token, value: Value): Value {
        this.fields.set(name.lexeme, value);
        return value;
    }

    call(interpreter: Interpreter, args: Value[]): Value {
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


export interface MethodDecl {
    isGetter: boolean,
    call: (this: NativeClassInstance, interpreter: Interpreter, args: Value[]) => Value,
}

export interface StaticMethodDecl {
    call: (interpreter: Interpreter, args: Value[]) => Value,
}

export interface Binding {
    name: string
    value: Value
}

export function makefn(
    name: string,
    arity: number,
    call: (interpreter: Interpreter, args: Value[]) => Value
): Binding {
    return {
        name: name,
        value: new NativeFuncImpl(name, arity, false, call)
    }
};
export function makeclass(
    name: string,
    methods: Record<string, MethodDecl> = {},
    staticMethods: Record<string, StaticMethodDecl> = {}
): Binding {
    const nativeMethods = new Map<string, NativeFuncImpl>();
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

export class Interpreter implements Ast.Expr.Visitor<Value>, Ast.Stmt.Visitor<void> {
    readonly globals = new Environment;
    private env = this.globals;
    private locals = new Map<Ast.Expr, number>();
    constructor(
        readonly ctx: Context
    ) {
        this.globals.define("type", makefn("type", 1, (_, [v]) => type(v)));
        this.globals.define("time", makefn("time", 0, () => Date.now()));
        this.globals.define("str", makefn("str", 1, (_, [v]) => stringify(v)));
    }

    interpret(stmtList: Ast.Stmt[]): void {
        try {
            for (let i = 0; i < stmtList.length; ++i) {
                this.execute(stmtList[i]);
            }
        } catch (error: unknown) {
            if (error instanceof LoxError) {
                this.ctx.error(error);
            } else {
                throw error;
            }
        }
    }
    resolve(expr: Ast.Expr, depth: number): void {
        this.locals.set(expr, depth);
    }
    lookup(name: Token, expr: Ast.Expr): Value {
        const distance = this.locals.get(expr);
        if (distance !== undefined) {
            return this.env.getAt(distance, name);
        } else {
            return this.globals.get(name);
        }
    }
    execute(stmt: Ast.Stmt): void {
        stmt.accept(this);
    }
    executeBlock(stmtList: Ast.Stmt[], env: Environment): void {
        const prevEnv = this.env;
        try {
            this.env = env;
            for (let i = 0; i < stmtList.length; ++i) {
                this.execute(stmtList[i]);
            }
        } finally {
            this.env = prevEnv;
        }
    }
    visitIfStmt(stmt: Ast.Stmt.If): void {
        if (isTruthy(this.evaluate(stmt.condition))) {
            this.execute(stmt.thenBranch)
        } else {
            if (stmt.elseBranch) this.execute(stmt.elseBranch);
        }
    }
    visitExpressionStmt(stmt: Ast.Stmt.Expression): void {
        this.evaluate(stmt.expr);
    }
    visitPrintStmt(stmt: Ast.Stmt.Print): void {
        if (stmt.expr.type === Ast.Expr.Type.Comma) {
            let parts = [];
            for (let i = 0, len = stmt.expr.list.length; i < len; ++i) {
                parts.push(stringify(this.evaluate(stmt.expr.list[i])));
            }
            console.log(join(parts, " "));
        } else {
            const value = this.evaluate(stmt.expr);
            console.log(stringify(value));
        }
    }
    visitLoopStmt(stmt: Ast.Stmt.Loop): void {
        const prevEnv = this.env;
        this.env = new Environment(this.env);
        if (stmt.init) this.execute(stmt.init);
        loop: while (isTruthy(this.evaluate(stmt.condition))) {
            try {
                this.execute(stmt.body);
                if (stmt.update) this.evaluate(stmt.update);
            } catch (error: unknown) {
                switch (error) {
                    case Signal.Break:
                        break loop;
                    case Signal.Continue:
                        if (stmt.update) this.evaluate(stmt.update);
                        continue loop;
                    default: throw error;
                }
            }
        }
        this.env = prevEnv;
    }
    visitBreakStmt(_stmt: Ast.Stmt.Break): void {
        throw Signal.Break;
    }
    visitContinueStmt(_stmt: Ast.Stmt.Continue): void {
        throw Signal.Continue;
    }
    visitVarStmt(stmt: Ast.Stmt.Var): void {
        let value = undefined;
        if (stmt.init) {
            value = this.evaluate(stmt.init);
        }

        this.env.define(stmt.name.lexeme, value);
    }
    visitBlockStmt(stmt: Ast.Stmt.Block): void {
        this.executeBlock(stmt.stmtList, new Environment(this.env));
    }
    visitFunctionStmt(stmt: Ast.Stmt.Function): void {
        this.env.define(stmt.name.lexeme, new FuncImpl(stmt, this.env, false));
    }
    visitReturnStmt(stmt: Ast.Stmt.Return): void {
        let value = null;
        if (stmt.value !== null) value = this.evaluate(stmt.value);

        throw new ReturnValue(value);
    }
    visitClassStmt(stmt: Ast.Stmt.Class): void {
        let superclass: ClassImpl | null = null;
        if (stmt.superclass !== null) {
            const impl = this.evaluate(stmt.superclass);
            if (type(impl) !== "class") {
                throw new LoxError(stmt.superclass.name.line, "Superclass must be a class");
            }
            superclass = impl as ClassImpl;
        }
        this.env.define(stmt.name.lexeme, null);
        if (superclass !== null) {
            this.env = new Environment(this.env);
            this.env.define("super", superclass);
        }
        const methods = new Map<string, FuncImpl>();
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
            this.env = this.env.enclosing!;
        }
        this.env.assign(stmt.name, impl);
    }
    evaluate(expr: Ast.Expr): Value {
        return expr.accept(this);
    }
    visitAssignExpr(expr: Ast.Expr.Assign): Value {
        const value = this.evaluate(expr.value);
        const depth = this.locals.get(expr);
        if (depth !== undefined) {
            this.env.assignAt(depth, expr.name, value);
        } else {
            this.globals.assign(expr.name, value);
        }
        return value;
    }
    visitVariableExpr(expr: Ast.Expr.Variable): Value {
        return this.lookup(expr.name, expr);
    }
    visitUnaryExpr(expr: Ast.Expr.Unary): Value {
        const right = this.evaluate(expr.right);

        switch (expr.op.type) {
            case Token.Type.BANG:
                return !isTruthy(right);
            case Token.Type.MINUS:
                assertType(right, "number", "Operand must be a number", expr.op.line);
                return -(right as number);
        }

        return null;
    }
    visitGroupingExpr(expr: Ast.Expr.Grouping): Value {
        return this.evaluate(expr.inner);
    }
    visitLiteralExpr(expr: Ast.Expr.Literal): Value {
        return expr.value;
    }
    visitBinaryExpr(expr: Ast.Expr.Binary): Value {
        const left = this.evaluate(expr.left);
        const right = this.evaluate(expr.right);

        switch (expr.op.type) {
            case Token.Type.BANG_EQUAL:
                return !isEqual(left, right);
            case Token.Type.EQUAL_EQUAL:
                return isEqual(left, right);
            case Token.Type.GREATER:
                assertType(left, "number", "Operand must be a number", expr.op.line);
                assertType(right, "number", "Operand must be a number", expr.op.line);
                return (<number>left) > (<number>right);
            case Token.Type.GREATER_EQUAL:
                assertType(left, "number", "Operand must be a number", expr.op.line);
                assertType(right, "number", "Operand must be a number", expr.op.line);
                return (<number>left) >= (<number>right);
            case Token.Type.LESS:
                assertType(left, "number", "Operand must be a number", expr.op.line);
                assertType(right, "number", "Operand must be a number", expr.op.line);
                return (<number>left) < (<number>right);
            case Token.Type.LESS_EQUAL:
                assertType(left, "number", "Operand must be a number", expr.op.line);
                assertType(right, "number", "Operand must be a number", expr.op.line);
                return (<number>left) <= (<number>right);
            case Token.Type.MINUS:
                assertType(left, "number", "Operand must be a number", expr.op.line);
                assertType(right, "number", "Operand must be a number", expr.op.line);
                return (<number>left) - (<number>right);
            case Token.Type.PLUS:
                if (typeof left === "number" && typeof right === "number") {
                    return left + right;
                }
                if (typeof left === "string" && typeof right === "string") {
                    return left + right;
                }
                throw new LoxError(expr.op.line, "Operands must both be a number or a string");
            case Token.Type.SLASH:
                assertType(left, "number", "Operand must be a number", expr.op.line);
                assertType(right, "number", "Operand must be a number", expr.op.line);
                return (<number>left) / (<number>right);
            case Token.Type.STAR:
                assertType(left, "number", "Operand must be a number", expr.op.line);
                assertType(right, "number", "Operand must be a number", expr.op.line);
                return (<number>left) * (<number>right);
            case Token.Type.PERCENT:
                assertType(left, "number", "Operand must be a number", expr.op.line);
                assertType(right, "number", "Operand must be a number", expr.op.line);
                return (<number>left) % (<number>right);
            case Token.Type.POWER:
                assertType(left, "number", "Operand must be a number", expr.op.line);
                assertType(right, "number", "Operand must be a number", expr.op.line);
                return (<number>left) ** (<number>right);
        }

        return null;
    }
    visitLogicalExpr(expr: Ast.Expr.Logical): Value {
        const left = this.evaluate(expr.left);

        if (expr.op.type === Token.Type.OR) {
            if (isTruthy(left)) return left;
        } else {
            if (!isTruthy(left)) return left;
        }

        return this.evaluate(expr.right);
    }
    visitCommaExpr(expr: Ast.Expr.Comma): Value {
        // everything but the last operand are side-effects
        let val = this.evaluate(expr.list[0]);
        for (let i = 1; i < expr.list.length; ++i) {
            val = this.evaluate(expr.list[i]);
        }
        return val;
    }
    visitCallExpr(expr: Ast.Expr.Call): Value {
        const callee = this.evaluate(expr.callee);

        const args = [];
        for (let i = 0; i < expr.args.length; ++i) {
            args.push(this.evaluate(expr.args[i]));
        }

        if (callee === null || (<func>callee).call == null || (<func>callee).arity == null) {
            throw new LoxError(expr.end.line, "Value is not callable");
        }

        const fn = (<func>callee);
        if (args.length !== fn.arity) {
            throw new LoxError(expr.end.line,
                `Expected ${fn.arity} args but got ${args.length}`);
        }

        return (<func>callee).call(this, args);
    }
    visitFunctionExpr(expr: Ast.Expr.Function): Value {
        return new FuncImpl(expr, this.env, false);
    }
    visitGetExpr(expr: Ast.Expr.Get): Value {
        const object = this.evaluate(expr.object);
        const t = type(object);
        if (t === "object") {
            const prop = (<instance>object).get(expr.name);
            if (type(prop) === "func" && (<func>prop).isGetter) {
                return (<func>prop).call(this, []);
            }
            return prop;
        }

        if (t === "class") {
            return (<impl>object).getStatic(expr.name);
        }

        throw new LoxError(expr.name.line, "Value is not a class instance");
    }
    visitSetExpr(expr: Ast.Expr.Set): Value {
        const object = this.evaluate(expr.object);
        const t = type(object);
        if (t === "object") {
            const value = this.evaluate(expr.value);
            return (<instance>object).set(expr.name, value);
        }

        if (t === "class") {
            const value = this.evaluate(expr.value);
            return (<impl>object).setStatic(expr.name, value);
        }

        throw new LoxError(expr.name.line, "Value is not a class instance");
    }
    visitDeleteExpr(expr: Ast.Expr.Delete): Value {
        const object = this.evaluate(expr.object);
        const t = type(object);
        if (t === "object" || t === "class") {
            return (<impl>object).del(expr.name);
        }

        throw new LoxError(expr.name.line, "Value is not a class instance");
    }
    visitThisExpr(expr: Ast.Expr.This): Value {
        return this.lookup(expr.keyword, expr);
    }
    visitSuperExpr(expr: Ast.Expr.Super): Value {
        const depth = this.locals.get(expr)!;
        const superclass = this.env.getUncheckedAt(depth, "super") as ClassImpl;
        const object = this.env.getUncheckedAt(depth - 1, "this") as ClassInstance;
        if (object === undefined) {
            // static context
            const value = superclass.getStaticOpt(expr.value);
            if (value === undefined) {
                throw new LoxError(expr.keyword.line, `Undefined property '${expr.value.lexeme}'`);
            }
            return value;
        } else {
            // instance context
            const value = superclass.getOpt(expr.value);
            if (value === undefined) {
                throw new LoxError(expr.keyword.line, `Undefined property '${expr.value.lexeme}'`);
            }
            if (type(value) === "func") {
                return (<FuncImpl>value).bind(object);
            }
            return value;
        }
    }
}

function isTruthy(value: Value): boolean {
    if (value === null) return false;
    if (typeof value === "boolean") return value;
    return true;
}

function isEqual(left: Value, right: Value): boolean {
    if (left === null) {
        if (right === null) return true;
        return false;
    }

    return left === right;
}

function assertType(value: Value, expected: string, message: string, line: number): void {
    let actual = typeof value as string;
    if (value === null) actual = "null";
    if (actual !== expected) {
        throw new LoxError(line, message);
    }
}

function join(arr: string[], sep: string) {
    let out = "";
    const end = arr.length - 1;
    for (let i = 0; i < end; ++i) {
        out += arr[i] + sep;
    }
    out += arr[end];
    return out;
}

export function stringify(value: Value): string {
    if (value === null) return "nil";
    if (value === Infinity) return "inf";
    return value.toString();
}