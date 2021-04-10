import { Token } from "./lexer";

export type Stmt =
    | Stmt.Expression
    | Stmt.Print
    | Stmt.Var
    | Stmt.Block
    | Stmt.If
    | Stmt.Loop
    | Stmt.Break
    | Stmt.Continue
    | Stmt.Function
    | Stmt.Return
    | Stmt.Class
    ;

export namespace Stmt {
    export interface Visitor<R> {
        visitExpressionStmt(stmt: Expression): R;
        visitPrintStmt(stmt: Print): R;
        visitVarStmt(stmt: Var): R;
        visitBlockStmt(stmt: Block): R;
        visitIfStmt(stmt: If): R;
        visitLoopStmt(stmt: Loop): R;
        visitBreakStmt(stmt: Break): R;
        visitContinueStmt(stmt: Continue): R;
        visitFunctionStmt(stmt: Function): R;
        visitReturnStmt(stmt: Return): R;
        visitClassStmt(stmt: Class): R;
    }

    export const enum Type {
        Expression,
        Print,
        Var,
        Block,
        If,
        Loop,
        Break,
        Continue,
        Function,
        Return,
        Class
    }

    export class Expression {
        readonly type = Type.Expression;
        constructor(
            readonly expr: Expr
        ) { }

        accept<R>(visitor: Visitor<R>): R {
            return visitor.visitExpressionStmt(this);
        }
    }

    export class Print {
        readonly type = Type.Print;
        constructor(
            readonly expr: Expr
        ) { }

        accept<R>(visitor: Visitor<R>): R {
            return visitor.visitPrintStmt(this);
        }
    }

    export class Var {
        readonly type = Type.Var;
        constructor(
            readonly name: Token,
            readonly init?: Expr,
        ) { }

        accept<R>(visitor: Visitor<R>): R {
            return visitor.visitVarStmt(this);
        }
    }

    export class Block {
        readonly type = Type.Block;
        constructor(
            readonly stmtList: Stmt[]
        ) { }

        accept<R>(visitor: Visitor<R>): R {
            return visitor.visitBlockStmt(this);
        }
    }

    export class If {
        readonly type = Type.If;
        constructor(
            readonly condition: Expr,
            readonly thenBranch: Stmt,
            readonly elseBranch: Stmt | null
        ) { }

        accept<R>(visitor: Visitor<R>): R {
            return visitor.visitIfStmt(this);
        }
    }

    export class Loop {
        readonly type = Type.Loop;
        constructor(
            readonly init: Stmt | null,
            readonly condition: Expr,
            readonly update: Expr | null,
            readonly body: Stmt
        ) { }

        accept<R>(visitor: Visitor<R>): R {
            return visitor.visitLoopStmt(this);
        }
    }

    export class Break {
        readonly type = Type.Break;
        constructor(
            readonly keyword: Token
        ) { }

        accept<R>(visitor: Visitor<R>): R {
            return visitor.visitBreakStmt(this);
        }
    }

    export class Continue {
        readonly type = Type.Continue;
        constructor(
            readonly keyword: Token
        ) { }

        accept<R>(visitor: Visitor<R>): R {
            return visitor.visitContinueStmt(this);
        }
    }

    export class Function {
        readonly type = Type.Function;
        constructor(
            readonly name: Token,
            readonly params: Token[] | null,
            readonly body: Stmt[]
        ) { }

        accept<R>(visitor: Visitor<R>): R {
            return visitor.visitFunctionStmt(this);
        }
    }

    export class Return {
        readonly type = Type.Return;
        constructor(
            readonly keyword: Token,
            readonly value: Expr | null
        ) { }

        accept<R>(visitor: Visitor<R>): R {
            return visitor.visitReturnStmt(this);
        }
    }

    export class Class {
        readonly type = Type.Class;
        constructor(
            readonly name: Token,
            readonly superclass: Expr.Variable | null,
            readonly methods: Stmt.Function[],
            readonly staticMethods: Stmt.Function[]
        ) { }

        accept<R>(visitor: Visitor<R>): R {
            return visitor.visitClassStmt(this);
        }
    }
}

export type Expr =
    | Expr.Binary
    | Expr.Unary
    | Expr.Literal
    | Expr.Grouping
    | Expr.Variable
    | Expr.Assign
    | Expr.Logical
    | Expr.Comma
    | Expr.Call
    | Expr.Function
    | Expr.Get
    | Expr.Set
    | Expr.Delete
    | Expr.This
    | Expr.Super
    ;

export namespace Expr {
    export interface Visitor<R> {
        visitUnaryExpr(expr: Unary): R;
        visitGroupingExpr(expr: Grouping): R;
        visitLiteralExpr(expr: Literal): R;
        visitBinaryExpr(expr: Binary): R;
        visitVariableExpr(expr: Variable): R;
        visitAssignExpr(expr: Assign): R;
        visitLogicalExpr(expr: Logical): R;
        visitCommaExpr(expr: Comma): R;
        visitCallExpr(expr: Call): R;
        visitFunctionExpr(expr: Function): R;
        visitGetExpr(expr: Get): R;
        visitSetExpr(expr: Set): R;
        visitDeleteExpr(expr: Delete): R;
        visitThisExpr(expr: This): R;
        visitSuperExpr(expr: Super): R;
    }

    export const enum Type {
        Unary,
        Binary,
        Literal,
        Grouping,
        Variable,
        Assign,
        Logical,
        Comma,
        Call,
        Function,
        Get,
        Set,
        Delete,
        This,
        Super
    }

    export class Unary {
        readonly type = Type.Unary;
        constructor(
            readonly op: Token,
            readonly right: Expr
        ) { }

        accept<R>(visitor: Visitor<R>): R {
            return visitor.visitUnaryExpr(this);
        }
    }

    export class Grouping {
        readonly type = Type.Grouping;
        constructor(
            readonly inner: Expr
        ) { }

        accept<R>(visitor: Visitor<R>): R {
            return visitor.visitGroupingExpr(this);
        }
    }

    export class Literal {
        readonly type = Type.Literal;
        constructor(
            readonly value: string | number | boolean | null
        ) { }

        accept<R>(visitor: Visitor<R>): R {
            return visitor.visitLiteralExpr(this);
        }
    }

    export class Binary {
        readonly type = Type.Binary;
        constructor(
            readonly left: Expr,
            readonly op: Token,
            readonly right: Expr
        ) { }

        accept<R>(visitor: Visitor<R>): R {
            return visitor.visitBinaryExpr(this);
        }
    }

    export class Variable {
        readonly type = Type.Variable;
        constructor(
            readonly name: Token
        ) { }

        accept<R>(visitor: Visitor<R>): R {
            return visitor.visitVariableExpr(this);
        }
    }

    export class Assign {
        readonly type = Type.Assign;
        constructor(
            readonly name: Token,
            readonly value: Expr
        ) { }

        accept<R>(visitor: Visitor<R>): R {
            return visitor.visitAssignExpr(this);
        }
    }

    export class Logical {
        readonly type = Type.Logical;
        constructor(
            readonly left: Expr,
            readonly op: Token,
            readonly right: Expr
        ) { }

        accept<R>(visitor: Visitor<R>): R {
            return visitor.visitLogicalExpr(this);
        }
    }

    export class Comma {
        readonly type = Type.Comma;
        constructor(
            readonly list: Expr[]
        ) { }

        accept<R>(visitor: Visitor<R>): R {
            return visitor.visitCommaExpr(this);
        }
    }

    export class Call {
        readonly type = Type.Call;
        constructor(
            readonly callee: Expr,
            readonly end: Token,
            readonly args: Expr[]
        ) { }

        accept<R>(visitor: Visitor<R>): R {
            return visitor.visitCallExpr(this);
        }
    }

    export class Function {
        readonly type = Type.Function;
        constructor(
            readonly name: Token | null,
            readonly params: Token[],
            readonly body: Stmt[]
        ) { }

        accept<R>(visitor: Visitor<R>): R {
            return visitor.visitFunctionExpr(this);
        }
    }

    export class Get {
        readonly type = Type.Get;
        constructor(
            readonly object: Expr,
            readonly name: Token,
        ) { }

        accept<R>(visitor: Visitor<R>): R {
            return visitor.visitGetExpr(this);
        }
    }

    export class Set {
        readonly type = Type.Set;
        constructor(
            readonly object: Expr,
            readonly name: Token,
            readonly value: Expr
        ) { }

        accept<R>(visitor: Visitor<R>): R {
            return visitor.visitSetExpr(this);
        }
    }

    export class Delete {
        readonly type = Type.Delete;
        constructor(
            readonly object: Expr,
            readonly name: Token,
        ) { }

        accept<R>(visitor: Visitor<R>): R {
            return visitor.visitDeleteExpr(this);
        }
    }

    export class This {
        readonly type = Type.This;
        constructor(
            readonly keyword: Token
        ) { }

        accept<R>(visitor: Visitor<R>): R {
            return visitor.visitThisExpr(this);
        }
    }

    export class Super {
        readonly type = Type.Super;
        constructor(
            readonly keyword: Token,
            readonly value: Token
        ) { }

        accept<R>(visitor: Visitor<R>): R {
            return visitor.visitSuperExpr(this);
        }
    }
}
