export var Stmt;
(function (Stmt) {
    class Expression {
        constructor(expr) {
            this.expr = expr;
            this.type = 0 /* Expression */;
        }
        accept(visitor) {
            return visitor.visitExpressionStmt(this);
        }
    }
    Stmt.Expression = Expression;
    class Print {
        constructor(expr) {
            this.expr = expr;
            this.type = 1 /* Print */;
        }
        accept(visitor) {
            return visitor.visitPrintStmt(this);
        }
    }
    Stmt.Print = Print;
    class Var {
        constructor(name, init) {
            this.name = name;
            this.init = init;
            this.type = 2 /* Var */;
        }
        accept(visitor) {
            return visitor.visitVarStmt(this);
        }
    }
    Stmt.Var = Var;
    class Block {
        constructor(stmtList) {
            this.stmtList = stmtList;
            this.type = 3 /* Block */;
        }
        accept(visitor) {
            return visitor.visitBlockStmt(this);
        }
    }
    Stmt.Block = Block;
    class If {
        constructor(condition, thenBranch, elseBranch) {
            this.condition = condition;
            this.thenBranch = thenBranch;
            this.elseBranch = elseBranch;
            this.type = 4 /* If */;
        }
        accept(visitor) {
            return visitor.visitIfStmt(this);
        }
    }
    Stmt.If = If;
    class Loop {
        constructor(init, condition, update, body) {
            this.init = init;
            this.condition = condition;
            this.update = update;
            this.body = body;
            this.type = 5 /* Loop */;
        }
        accept(visitor) {
            return visitor.visitLoopStmt(this);
        }
    }
    Stmt.Loop = Loop;
    class Break {
        constructor(keyword) {
            this.keyword = keyword;
            this.type = 6 /* Break */;
        }
        accept(visitor) {
            return visitor.visitBreakStmt(this);
        }
    }
    Stmt.Break = Break;
    class Continue {
        constructor(keyword) {
            this.keyword = keyword;
            this.type = 7 /* Continue */;
        }
        accept(visitor) {
            return visitor.visitContinueStmt(this);
        }
    }
    Stmt.Continue = Continue;
    class Function {
        constructor(name, params, body) {
            this.name = name;
            this.params = params;
            this.body = body;
            this.type = 8 /* Function */;
        }
        accept(visitor) {
            return visitor.visitFunctionStmt(this);
        }
    }
    Stmt.Function = Function;
    class Return {
        constructor(keyword, value) {
            this.keyword = keyword;
            this.value = value;
            this.type = 9 /* Return */;
        }
        accept(visitor) {
            return visitor.visitReturnStmt(this);
        }
    }
    Stmt.Return = Return;
    class Class {
        constructor(name, superclass, methods, staticMethods) {
            this.name = name;
            this.superclass = superclass;
            this.methods = methods;
            this.staticMethods = staticMethods;
            this.type = 10 /* Class */;
        }
        accept(visitor) {
            return visitor.visitClassStmt(this);
        }
    }
    Stmt.Class = Class;
})(Stmt || (Stmt = {}));
export var Expr;
(function (Expr) {
    class Unary {
        constructor(op, right) {
            this.op = op;
            this.right = right;
            this.type = 0 /* Unary */;
        }
        accept(visitor) {
            return visitor.visitUnaryExpr(this);
        }
    }
    Expr.Unary = Unary;
    class Grouping {
        constructor(inner) {
            this.inner = inner;
            this.type = 3 /* Grouping */;
        }
        accept(visitor) {
            return visitor.visitGroupingExpr(this);
        }
    }
    Expr.Grouping = Grouping;
    class Literal {
        constructor(value) {
            this.value = value;
            this.type = 2 /* Literal */;
        }
        accept(visitor) {
            return visitor.visitLiteralExpr(this);
        }
    }
    Expr.Literal = Literal;
    class Binary {
        constructor(left, op, right) {
            this.left = left;
            this.op = op;
            this.right = right;
            this.type = 1 /* Binary */;
        }
        accept(visitor) {
            return visitor.visitBinaryExpr(this);
        }
    }
    Expr.Binary = Binary;
    class Variable {
        constructor(name) {
            this.name = name;
            this.type = 4 /* Variable */;
        }
        accept(visitor) {
            return visitor.visitVariableExpr(this);
        }
    }
    Expr.Variable = Variable;
    class Assign {
        constructor(name, value) {
            this.name = name;
            this.value = value;
            this.type = 5 /* Assign */;
        }
        accept(visitor) {
            return visitor.visitAssignExpr(this);
        }
    }
    Expr.Assign = Assign;
    class Logical {
        constructor(left, op, right) {
            this.left = left;
            this.op = op;
            this.right = right;
            this.type = 6 /* Logical */;
        }
        accept(visitor) {
            return visitor.visitLogicalExpr(this);
        }
    }
    Expr.Logical = Logical;
    class Comma {
        constructor(list) {
            this.list = list;
            this.type = 7 /* Comma */;
        }
        accept(visitor) {
            return visitor.visitCommaExpr(this);
        }
    }
    Expr.Comma = Comma;
    class Call {
        constructor(callee, end, args) {
            this.callee = callee;
            this.end = end;
            this.args = args;
            this.type = 8 /* Call */;
        }
        accept(visitor) {
            return visitor.visitCallExpr(this);
        }
    }
    Expr.Call = Call;
    class Function {
        constructor(name, params, body) {
            this.name = name;
            this.params = params;
            this.body = body;
            this.type = 9 /* Function */;
        }
        accept(visitor) {
            return visitor.visitFunctionExpr(this);
        }
    }
    Expr.Function = Function;
    class Get {
        constructor(object, name) {
            this.object = object;
            this.name = name;
            this.type = 10 /* Get */;
        }
        accept(visitor) {
            return visitor.visitGetExpr(this);
        }
    }
    Expr.Get = Get;
    class Set {
        constructor(object, name, value) {
            this.object = object;
            this.name = name;
            this.value = value;
            this.type = 11 /* Set */;
        }
        accept(visitor) {
            return visitor.visitSetExpr(this);
        }
    }
    Expr.Set = Set;
    class Delete {
        constructor(object, name) {
            this.object = object;
            this.name = name;
            this.type = 12 /* Delete */;
        }
        accept(visitor) {
            return visitor.visitDeleteExpr(this);
        }
    }
    Expr.Delete = Delete;
    class This {
        constructor(keyword) {
            this.keyword = keyword;
            this.type = 13 /* This */;
        }
        accept(visitor) {
            return visitor.visitThisExpr(this);
        }
    }
    Expr.This = This;
    class Super {
        constructor(keyword, value) {
            this.keyword = keyword;
            this.value = value;
            this.type = 14 /* Super */;
        }
        accept(visitor) {
            return visitor.visitSuperExpr(this);
        }
    }
    Expr.Super = Super;
})(Expr || (Expr = {}));
