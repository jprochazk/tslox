import * as Ast from "./ast";
import { Context } from "./ctx";
import { Interpreter } from "./interpreter";
import { Token } from "./lexer";
import { LoxError } from "./error";

type NonEmptyStack<T> = Stack<T> & {
    top: T
};

class Stack<T> {
    private _inner: T[] = [];

    notEmpty(): this is NonEmptyStack<T> {
        return this._inner.length !== 0;
    }

    get inner(): readonly T[] {
        return this._inner;
    }

    get top(): T | undefined {
        return this._inner[this._inner.length - 1];
    }

    push(value: T) {
        this._inner.push(value);
    }
    pop(): T | undefined {
        return this._inner.pop();
    }
}

enum FunctionKind {
    NONE,
    FUNCTION,
    METHOD,
    INIT
}

enum LoopKind {
    NONE,
    SOME
}

enum ClassKind {
    NONE,
    CLASS,
    SUBCLASS
}

interface Local {
    name: Token,
    defined: boolean,
    used: boolean
}

export class Resolver implements Ast.Expr.Visitor<void>, Ast.Stmt.Visitor<void> {
    private scopes: Stack<Map<string, Local>> = new Stack;
    private currentFunction = FunctionKind.NONE;
    private currentLoop = LoopKind.NONE;
    private currentClass = ClassKind.NONE;

    constructor(
        readonly ctx: Context,
        readonly interpreter: Interpreter,
    ) { }

    reset() {
        this.scopes = new Stack;
        this.currentFunction = FunctionKind.NONE;
        this.currentLoop = LoopKind.NONE;
        this.currentClass = ClassKind.NONE;
    }

    run(list: Ast.Stmt[]): void {
        this.resolve(list);
    }
    resolve(list: (Ast.Stmt | Ast.Expr | null | undefined)[]): void {
        for (let i = 0; i < list.length; ++i) {
            const item = list[i];
            if (item) item.accept(this);
        }
    }
    private resolveLocal(expr: Ast.Expr, name: Token): void {
        for (let i = 0; i < this.scopes.inner.length; ++i) {
            const v = this.scopes.inner[i].get(name.lexeme);
            if (v !== undefined) {
                v.used = true; // this local var is referenced at least once
                this.interpreter.resolve(expr, this.scopes.inner.length - 1 - i);
                return;
            }
        }
    }
    private resolveFunction(fn: Ast.Stmt.Function | Ast.Expr.Function, kind: FunctionKind): void {
        const enclosingFunction = this.currentFunction;
        this.currentFunction = kind;
        this.beginScope();
        if (fn.params) {
            for (let i = 0; i < fn.params.length; ++i) {
                this.declare(fn.params[i]);
                this.define(fn.params[i]);
            }
        }
        this.resolve(fn.body);
        this.endScope();
        this.currentFunction = enclosingFunction;
    }

    private beginScope(): void {
        this.scopes.push(new Map);
    }
    private endScope(): void {
        const scope = this.scopes.pop()!;
        for (const local of scope.values()) {
            if (!local.used) {
                console.warn(`[line ${local.name.line}] Warning: Unused local variable '${local.name.lexeme}'`);
            }
        }
    }
    private declare(name: Token): void {
        if (!this.scopes.notEmpty()) return;
        const top = this.scopes.top;
        if (top.has(name.lexeme)) {
            this.ctx.error(name, `Cannot re-declare variable '${name.lexeme}'`);
        }
        top.set(name.lexeme, { name, defined: false, used: false });
    }
    private define(name: Token): void {
        if (!this.scopes.notEmpty()) return;
        this.scopes.top.get(name.lexeme)!.defined = true;
    }

    visitExpressionStmt(stmt: Ast.Stmt.Expression): void {
        this.resolve([stmt.expr]);
    }
    visitPrintStmt(stmt: Ast.Stmt.Print): void {
        this.resolve([stmt.expr]);
    }
    visitVarStmt(stmt: Ast.Stmt.Var): void {
        this.declare(stmt.name);
        if (stmt.init != null) {
            this.resolve([stmt.init]);
        }
        this.define(stmt.name);
    }
    visitBlockStmt(stmt: Ast.Stmt.Block): void {
        this.beginScope();
        this.resolve(stmt.stmtList);
        this.endScope();
    }
    visitIfStmt(stmt: Ast.Stmt.If): void {
        this.resolve([stmt.condition, stmt.thenBranch, stmt.elseBranch]);
    }
    visitLoopStmt(stmt: Ast.Stmt.Loop): void {
        const enclosing = this.currentLoop;
        this.currentLoop = LoopKind.SOME;
        this.beginScope();
        this.resolve([stmt.init, stmt.condition, stmt.update, stmt.body]);
        this.endScope();
        this.currentLoop = enclosing;
    }
    visitBreakStmt(stmt: Ast.Stmt.Break): void {
        if (this.currentLoop === LoopKind.NONE) {
            this.ctx.error(stmt.keyword, "Break statements are invalid outside of loops");
        }
    }
    visitContinueStmt(stmt: Ast.Stmt.Continue): void {
        if (this.currentLoop === LoopKind.NONE) {
            this.ctx.error(stmt.keyword, "Break statements are invalid outside of loops");
        }
    }
    visitFunctionStmt(stmt: Ast.Stmt.Function): void {
        this.declare(stmt.name);
        this.define(stmt.name);

        this.resolveFunction(stmt, FunctionKind.FUNCTION);
    }
    visitReturnStmt(stmt: Ast.Stmt.Return): void {
        if (this.currentFunction === FunctionKind.NONE) {
            this.ctx.error(stmt.keyword, "Return statements are invalid at the top level");
        }
        if (stmt.value !== null) {
            if (this.currentFunction === FunctionKind.INIT) {
                this.ctx.error(stmt.keyword, "Cannot return value from an initializer");
            }
            this.resolve([stmt.value]);
        }
    }
    visitClassStmt(stmt: Ast.Stmt.Class): void {
        const enclosing = this.currentClass;
        this.currentClass = ClassKind.CLASS;

        this.declare(stmt.name);
        this.define(stmt.name);

        if (stmt.superclass !== null) {
            if (stmt.name.lexeme === stmt.superclass.name.lexeme) {
                this.ctx.error(new LoxError(stmt.superclass.name.line,
                    "A class can't inherit from itself"));
            }
            this.currentClass = ClassKind.SUBCLASS;
            this.resolve([stmt.superclass]);
        }

        if (stmt.superclass !== null) {
            this.beginScope();
            this.scopes.top!.set("super", {
                name: new Token(Token.Type.SUPER, "super", null, stmt.name.line),
                defined: true,
                used: true
            })
        }

        for (let i = 0; i < stmt.staticMethods.length; ++i) {
            this.resolveFunction(stmt.staticMethods[i], FunctionKind.FUNCTION);
        }

        this.beginScope();
        this.scopes.top!.set("this", {
            name: new Token(Token.Type.THIS, "this", null, stmt.name.line),
            defined: true,
            used: true
        });

        for (let i = 0; i < stmt.methods.length; ++i) {
            let kind = FunctionKind.METHOD;
            if (stmt.methods[i].name.lexeme === "init") {
                kind = FunctionKind.INIT;
            }
            this.resolveFunction(stmt.methods[i], kind);
        }

        this.endScope();
        if (stmt.superclass !== null) this.endScope();
        this.currentClass = enclosing;
    }
    visitUnaryExpr(expr: Ast.Expr.Unary): void {
        this.resolve([expr.right]);
    }
    visitGroupingExpr(expr: Ast.Expr.Grouping): void {
        this.resolve([expr.inner]);
    }
    visitLiteralExpr(_expr: Ast.Expr.Literal): void { }
    visitBinaryExpr(expr: Ast.Expr.Binary): void {
        this.resolve([expr.left, expr.right]);
    }
    visitVariableExpr(expr: Ast.Expr.Variable): void {
        if (this.scopes.notEmpty() &&
            this.scopes.top.get(expr.name.lexeme)?.defined === false) {
            this.ctx.error(new LoxError(expr.name.line,
                "Cannot refer to a variable in it's own initializer"));
        }

        this.resolveLocal(expr, expr.name);
    }
    visitAssignExpr(expr: Ast.Expr.Assign): void {
        this.resolve([expr.value]);
        this.resolveLocal(expr, expr.name);
    }
    visitLogicalExpr(expr: Ast.Expr.Logical): void {
        this.resolve([expr.left, expr.right]);
    }
    visitCommaExpr(expr: Ast.Expr.Comma): void {
        this.resolve(expr.list);
    }
    visitCallExpr(expr: Ast.Expr.Call): void {
        this.resolve([expr.callee]);
        this.resolve(expr.args);
    }
    visitFunctionExpr(expr: Ast.Expr.Function): void {
        this.resolveFunction(expr, FunctionKind.FUNCTION);
    }
    visitGetExpr(expr: Ast.Expr.Get): void {
        this.resolve([expr.object]);
    }
    visitSetExpr(expr: Ast.Expr.Set): void {
        this.resolve([expr.value, expr.object]);
    }
    visitDeleteExpr(expr: Ast.Expr.Delete): void {
        this.resolve([expr.object]);
    }
    visitThisExpr(expr: Ast.Expr.This): void {
        if (this.currentClass == ClassKind.NONE) {
            this.ctx.error(expr.keyword, "Cannot use 'this' outside of a class");
            return;
        }
        this.resolveLocal(expr, expr.keyword);
    }
    visitSuperExpr(expr: Ast.Expr.Super): void {
        if (this.currentClass == ClassKind.NONE) {
            this.ctx.error(expr.keyword, "Cannot use 'super' outside of a class");
        } else if (this.currentClass !== ClassKind.SUBCLASS) {
            this.ctx.error(expr.keyword, "Cannot use 'super' in a class with no parent class");
        }
        this.resolveLocal(expr, expr.keyword);
    }
}