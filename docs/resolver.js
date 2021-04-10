import { Token } from "./lexer.js";
import { LoxError } from "./error.js";
class Stack {
    constructor() {
        this._inner = [];
    }
    notEmpty() {
        return this._inner.length !== 0;
    }
    get inner() {
        return this._inner;
    }
    get top() {
        return this._inner[this._inner.length - 1];
    }
    push(value) {
        this._inner.push(value);
    }
    pop() {
        return this._inner.pop();
    }
}
var FunctionKind;
(function (FunctionKind) {
    FunctionKind[FunctionKind["NONE"] = 0] = "NONE";
    FunctionKind[FunctionKind["FUNCTION"] = 1] = "FUNCTION";
    FunctionKind[FunctionKind["METHOD"] = 2] = "METHOD";
    FunctionKind[FunctionKind["INIT"] = 3] = "INIT";
})(FunctionKind || (FunctionKind = {}));
var LoopKind;
(function (LoopKind) {
    LoopKind[LoopKind["NONE"] = 0] = "NONE";
    LoopKind[LoopKind["SOME"] = 1] = "SOME";
})(LoopKind || (LoopKind = {}));
var ClassKind;
(function (ClassKind) {
    ClassKind[ClassKind["NONE"] = 0] = "NONE";
    ClassKind[ClassKind["CLASS"] = 1] = "CLASS";
    ClassKind[ClassKind["SUBCLASS"] = 2] = "SUBCLASS";
})(ClassKind || (ClassKind = {}));
export class Resolver {
    constructor(ctx, interpreter) {
        this.ctx = ctx;
        this.interpreter = interpreter;
        this.scopes = new Stack;
        this.currentFunction = FunctionKind.NONE;
        this.currentLoop = LoopKind.NONE;
        this.currentClass = ClassKind.NONE;
    }
    reset() {
        this.scopes = new Stack;
        this.currentFunction = FunctionKind.NONE;
        this.currentLoop = LoopKind.NONE;
        this.currentClass = ClassKind.NONE;
    }
    run(list) {
        this.resolve(list);
    }
    resolve(list) {
        for (let i = 0; i < list.length; ++i) {
            const item = list[i];
            if (item)
                item.accept(this);
        }
    }
    resolveLocal(expr, name) {
        for (let i = 0; i < this.scopes.inner.length; ++i) {
            const v = this.scopes.inner[i].get(name.lexeme);
            if (v !== undefined) {
                v.used = true; // this local var is referenced at least once
                this.interpreter.resolve(expr, this.scopes.inner.length - 1 - i);
                return;
            }
        }
    }
    resolveFunction(fn, kind) {
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
    beginScope() {
        this.scopes.push(new Map);
    }
    endScope() {
        const scope = this.scopes.pop();
        for (const local of scope.values()) {
            if (!local.used) {
                this.ctx.logger.warn(`[line ${local.name.line}] Warning: Unused local variable '${local.name.lexeme}'`);
            }
        }
    }
    declare(name) {
        if (!this.scopes.notEmpty())
            return;
        const top = this.scopes.top;
        if (top.has(name.lexeme)) {
            this.ctx.error(name, `Cannot re-declare variable '${name.lexeme}'`);
        }
        top.set(name.lexeme, { name, defined: false, used: false });
    }
    define(name) {
        if (!this.scopes.notEmpty())
            return;
        this.scopes.top.get(name.lexeme).defined = true;
    }
    visitExpressionStmt(stmt) {
        this.resolve([stmt.expr]);
    }
    visitPrintStmt(stmt) {
        this.resolve([stmt.expr]);
    }
    visitVarStmt(stmt) {
        this.declare(stmt.name);
        if (stmt.init != null) {
            this.resolve([stmt.init]);
        }
        this.define(stmt.name);
    }
    visitBlockStmt(stmt) {
        this.beginScope();
        this.resolve(stmt.stmtList);
        this.endScope();
    }
    visitIfStmt(stmt) {
        this.resolve([stmt.condition, stmt.thenBranch, stmt.elseBranch]);
    }
    visitLoopStmt(stmt) {
        const enclosing = this.currentLoop;
        this.currentLoop = LoopKind.SOME;
        this.beginScope();
        this.resolve([stmt.init, stmt.condition, stmt.update, stmt.body]);
        this.endScope();
        this.currentLoop = enclosing;
    }
    visitBreakStmt(stmt) {
        if (this.currentLoop === LoopKind.NONE) {
            this.ctx.error(stmt.keyword, "Break statements are invalid outside of loops");
        }
    }
    visitContinueStmt(stmt) {
        if (this.currentLoop === LoopKind.NONE) {
            this.ctx.error(stmt.keyword, "Break statements are invalid outside of loops");
        }
    }
    visitFunctionStmt(stmt) {
        this.declare(stmt.name);
        this.define(stmt.name);
        this.resolveFunction(stmt, FunctionKind.FUNCTION);
    }
    visitReturnStmt(stmt) {
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
    visitClassStmt(stmt) {
        const enclosing = this.currentClass;
        this.currentClass = ClassKind.CLASS;
        this.declare(stmt.name);
        this.define(stmt.name);
        if (stmt.superclass !== null) {
            if (stmt.name.lexeme === stmt.superclass.name.lexeme) {
                this.ctx.error(new LoxError(stmt.superclass.name.line, "A class can't inherit from itself"));
            }
            this.currentClass = ClassKind.SUBCLASS;
            this.resolve([stmt.superclass]);
        }
        if (stmt.superclass !== null) {
            this.beginScope();
            this.scopes.top.set("super", {
                name: new Token(35 /* SUPER */, "super", null, stmt.name.line),
                defined: true,
                used: true
            });
        }
        for (let i = 0; i < stmt.staticMethods.length; ++i) {
            this.resolveFunction(stmt.staticMethods[i], FunctionKind.FUNCTION);
        }
        this.beginScope();
        this.scopes.top.set("this", {
            name: new Token(36 /* THIS */, "this", null, stmt.name.line),
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
        if (stmt.superclass !== null)
            this.endScope();
        this.currentClass = enclosing;
    }
    visitUnaryExpr(expr) {
        this.resolve([expr.right]);
    }
    visitGroupingExpr(expr) {
        this.resolve([expr.inner]);
    }
    visitLiteralExpr(_expr) { }
    visitBinaryExpr(expr) {
        this.resolve([expr.left, expr.right]);
    }
    visitVariableExpr(expr) {
        if (this.scopes.notEmpty() &&
            this.scopes.top.get(expr.name.lexeme)?.defined === false) {
            this.ctx.error(new LoxError(expr.name.line, "Cannot refer to a variable in it's own initializer"));
        }
        this.resolveLocal(expr, expr.name);
    }
    visitAssignExpr(expr) {
        this.resolve([expr.value]);
        this.resolveLocal(expr, expr.name);
    }
    visitLogicalExpr(expr) {
        this.resolve([expr.left, expr.right]);
    }
    visitCommaExpr(expr) {
        this.resolve(expr.list);
    }
    visitCallExpr(expr) {
        this.resolve([expr.callee]);
        this.resolve(expr.args);
    }
    visitFunctionExpr(expr) {
        this.resolveFunction(expr, FunctionKind.FUNCTION);
    }
    visitGetExpr(expr) {
        this.resolve([expr.object]);
    }
    visitSetExpr(expr) {
        this.resolve([expr.value, expr.object]);
    }
    visitDeleteExpr(expr) {
        this.resolve([expr.object]);
    }
    visitThisExpr(expr) {
        if (this.currentClass == ClassKind.NONE) {
            this.ctx.error(expr.keyword, "Cannot use 'this' outside of a class");
            return;
        }
        this.resolveLocal(expr, expr.keyword);
    }
    visitSuperExpr(expr) {
        if (this.currentClass == ClassKind.NONE) {
            this.ctx.error(expr.keyword, "Cannot use 'super' outside of a class");
        }
        else if (this.currentClass !== ClassKind.SUBCLASS) {
            this.ctx.error(expr.keyword, "Cannot use 'super' in a class with no parent class");
        }
        this.resolveLocal(expr, expr.keyword);
    }
}
