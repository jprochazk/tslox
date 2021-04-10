import * as Ast from "./ast.js";
export class ParseError extends Error {
}
export class Parser {
    constructor(ctx) {
        this.ctx = ctx;
        this.current = 0;
        this.tokens = [];
    }
    reset() {
        this.current = 0;
        this.tokens = [];
    }
    parse(tokens) {
        this.tokens = tokens;
        const stmts = [];
        while (!this.isAtEnd) {
            const decl = this.declaration();
            if (decl)
                stmts.push(decl);
        }
        return stmts;
    }
    previous() {
        return this.tokens[this.current - 1];
    }
    peek() {
        return this.tokens[this.current];
    }
    get isAtEnd() {
        return this.tokens.length === 0 || this.peek() === undefined || this.peek().type === 44 /* EOF */;
    }
    advance() {
        if (!this.isAtEnd)
            ++this.current;
        return this.previous();
    }
    check(type) {
        if (this.isAtEnd)
            return false;
        return this.peek().type === type;
    }
    match(...types) {
        for (let i = 0; i < types.length; ++i) {
            if (this.check(types[i])) {
                this.advance();
                return true;
            }
        }
        return false;
    }
    consume(type, message) {
        if (this.check(type))
            return this.advance();
        throw this.error(this.peek(), message);
    }
    error(token, message) {
        this.ctx.error(token, message);
        return new ParseError();
    }
    // PARSING
    declaration() {
        try {
            if (this.match(25 /* CLASS */))
                return this.classDeclaration();
            if (this.match(28 /* FUN */))
                return this.functionDeclaration("function");
            if (this.match(38 /* VAR */))
                return this.varDeclaration();
            return this.statement();
        }
        catch (error) {
            if (error instanceof ParseError) {
                this.synchronize();
                return null;
            }
            else {
                throw error;
            }
        }
    }
    classDeclaration() {
        const name = this.consume(21 /* IDENTIFIER */, `Expected class name`);
        let superclass = null;
        if (this.match(18 /* LESS */)) {
            const name = this.consume(21 /* IDENTIFIER */, "Expected superclass name");
            superclass = new Ast.Expr.Variable(name);
        }
        this.consume(2 /* LEFT_BRACE */, `Expected '{' after class name`);
        const methods = [];
        const staticMethods = [];
        while (!this.check(3 /* RIGHT_BRACE */) && !this.isAtEnd) {
            const isStatic = this.match(43 /* STATIC */);
            const decl = this.functionDeclaration("method");
            if (isStatic)
                staticMethods.push(decl);
            else
                methods.push(decl);
        }
        this.consume(3 /* RIGHT_BRACE */, `Expected '}' after class body`);
        return new Ast.Stmt.Class(name, superclass, methods, staticMethods);
    }
    functionDeclaration(kind) {
        const name = this.consume(21 /* IDENTIFIER */, `Expected ${kind} name`);
        let params = null;
        if (this.match(0 /* LEFT_PAREN */)) {
            // function/method
            params = [];
            if (!this.check(1 /* RIGHT_PAREN */)) {
                do {
                    if (params.length >= 255) {
                        this.error(this.peek(), "Functions may only have up to 255 parameters");
                    }
                    params.push(this.consume(21 /* IDENTIFIER */, "Expected parameter name"));
                } while (this.match(4 /* COMMA */));
            }
            this.consume(1 /* RIGHT_PAREN */, "Expected ')' after parameter list");
        }
        this.consume(2 /* LEFT_BRACE */, `Expected '{' after ${kind} declaration`);
        const body = this.block();
        if (kind === "function" && params === null) {
            this.error(this.peek(), "Getters may only exist within a class");
        }
        return new Ast.Stmt.Function(name, params, body);
    }
    varDeclaration() {
        const name = this.consume(21 /* IDENTIFIER */, "Expected identifier after 'var' statement");
        let init;
        if (this.match(14 /* EQUAL */)) {
            init = this.comma();
        }
        this.consume(8 /* SEMICOLON */, "Statements must be terminated by semicolons");
        return new Ast.Stmt.Var(name, init);
    }
    statement() {
        if (this.match(30 /* IF */))
            return this.ifStatement();
        if (this.match(33 /* PRINT */))
            return this.printStatement();
        if (this.match(34 /* RETURN */))
            return this.returnStatement();
        if (this.match(39 /* WHILE */))
            return this.whileStatement();
        if (this.match(29 /* FOR */))
            return this.forStatement();
        if (this.match(41 /* BREAK */))
            return this.breakStatement();
        if (this.match(40 /* CONTINUE */))
            return this.continueStatement();
        if (this.match(2 /* LEFT_BRACE */))
            return new Ast.Stmt.Block(this.block());
        return this.expressionStatement();
    }
    block() {
        const stmtList = [];
        while (!this.check(3 /* RIGHT_BRACE */) && !this.isAtEnd) {
            const decl = this.declaration();
            if (decl)
                stmtList.push(decl);
        }
        this.consume(3 /* RIGHT_BRACE */, "Expected '}' after block");
        return stmtList;
    }
    ifStatement() {
        this.consume(0 /* LEFT_PAREN */, "Expected '(' after 'if'");
        const condition = this.comma();
        this.consume(1 /* RIGHT_PAREN */, "Expected ')' after if condition");
        const thenBranch = this.statement();
        let elseBranch = null;
        if (this.match(26 /* ELSE */)) {
            elseBranch = this.statement();
        }
        return new Ast.Stmt.If(condition, thenBranch, elseBranch);
    }
    printStatement() {
        const expr = this.comma();
        this.consume(8 /* SEMICOLON */, "Statements must be terminated by semicolons");
        return new Ast.Stmt.Print(expr);
    }
    returnStatement() {
        const keyword = this.previous();
        let value = null;
        if (!this.check(8 /* SEMICOLON */)) {
            value = this.comma();
        }
        this.consume(8 /* SEMICOLON */, "Statements must be terminated by semicolons");
        return new Ast.Stmt.Return(keyword, value);
    }
    whileStatement() {
        this.consume(0 /* LEFT_PAREN */, "Expected '(' after 'while'");
        const condition = this.comma();
        this.consume(1 /* RIGHT_PAREN */, "Expected ')' after loop condition");
        const body = this.statement();
        return new Ast.Stmt.Loop(null, condition, null, body);
    }
    forStatement() {
        this.consume(0 /* LEFT_PAREN */, "Expected '(' after 'for'");
        let init;
        if (this.match(8 /* SEMICOLON */)) {
            init = null;
        }
        else if (this.match(38 /* VAR */)) {
            init = this.varDeclaration();
        }
        else {
            init = this.expressionStatement();
        }
        let condition = null;
        if (!this.check(8 /* SEMICOLON */)) {
            condition = this.comma();
        }
        this.consume(8 /* SEMICOLON */, "Expected ';' after loop condition");
        let update = null;
        if (!this.check(1 /* RIGHT_PAREN */)) {
            update = this.comma();
        }
        this.consume(1 /* RIGHT_PAREN */, "Expected ')' after loop clauses");
        let body = this.statement();
        if (condition === null)
            condition = new Ast.Expr.Literal(true);
        return new Ast.Stmt.Loop(init, condition, update, body);
    }
    breakStatement() {
        const keyword = this.previous();
        this.consume(8 /* SEMICOLON */, "Statements must be terminated by semicolons");
        return new Ast.Stmt.Break(keyword);
    }
    continueStatement() {
        const keyword = this.previous();
        this.consume(8 /* SEMICOLON */, "Statements must be terminated by semicolons");
        return new Ast.Stmt.Continue(keyword);
    }
    expressionStatement() {
        const expr = this.comma();
        this.consume(8 /* SEMICOLON */, "Statements must be terminated by semicolons");
        return new Ast.Stmt.Expression(expr);
    }
    comma() {
        const list = [this.expression()];
        while (this.match(4 /* COMMA */)) {
            list.push(this.expression());
        }
        if (list.length > 1) {
            return new Ast.Expr.Comma(list);
        }
        else {
            return list[0];
        }
    }
    expression() {
        return this.assignment();
    }
    assignment() {
        const expr = this.or();
        if (this.match(14 /* EQUAL */)) {
            const equals = this.previous();
            const value = this.assignment();
            if (expr instanceof Ast.Expr.Variable) {
                const name = expr.name;
                return new Ast.Expr.Assign(name, value);
            }
            else if (expr instanceof Ast.Expr.Get) {
                return new Ast.Expr.Set(expr.object, expr.name, value);
            }
            this.error(equals, "Invalid assignment target");
        }
        return expr;
    }
    or() {
        let expr = this.and();
        while (this.match(32 /* OR */)) {
            const op = this.previous();
            const right = this.and();
            expr = new Ast.Expr.Logical(expr, op, right);
        }
        return expr;
    }
    and() {
        let expr = this.equality();
        while (this.match(24 /* AND */)) {
            const op = this.previous();
            const right = this.equality();
            expr = new Ast.Expr.Logical(expr, op, right);
        }
        return expr;
    }
    equality() {
        let expr = this.comparison();
        while (this.match(13 /* BANG_EQUAL */, 15 /* EQUAL_EQUAL */)) {
            const op = this.previous();
            const right = this.comparison();
            expr = new Ast.Expr.Binary(expr, op, right);
        }
        return expr;
    }
    comparison() {
        let expr = this.term();
        while (this.match(16 /* GREATER */, 17 /* GREATER_EQUAL */, 18 /* LESS */, 19 /* LESS_EQUAL */)) {
            const op = this.previous();
            const right = this.term();
            expr = new Ast.Expr.Binary(expr, op, right);
        }
        return expr;
    }
    term() {
        let expr = this.factor();
        while (this.match(6 /* MINUS */, 7 /* PLUS */)) {
            const op = this.previous();
            const right = this.factor();
            expr = new Ast.Expr.Binary(expr, op, right);
        }
        return expr;
    }
    factor() {
        let expr = this.power();
        while (this.match(9 /* SLASH */, 10 /* STAR */, 11 /* PERCENT */)) {
            const op = this.previous();
            const right = this.power();
            expr = new Ast.Expr.Binary(expr, op, right);
        }
        return expr;
    }
    power() {
        let expr = this.unary();
        while (this.match(20 /* POWER */)) {
            const op = this.previous();
            const right = this.power();
            expr = new Ast.Expr.Binary(expr, op, right);
        }
        return expr;
    }
    unary() {
        if (this.match(12 /* BANG */, 6 /* MINUS */)) {
            const op = this.previous();
            const right = this.unary();
            return new Ast.Expr.Unary(op, right);
        }
        return this.call();
    }
    call() {
        let expr = this.primary();
        for (;;) {
            if (this.match(0 /* LEFT_PAREN */)) {
                expr = this.finishCall(expr);
            }
            else if (this.match(5 /* DOT */)) {
                const name = this.consume(21 /* IDENTIFIER */, "Expected property name after '.'");
                expr = new Ast.Expr.Get(expr, name);
            }
            else {
                break;
            }
        }
        return expr;
    }
    finishCall(callee) {
        const args = [];
        if (!this.check(1 /* RIGHT_PAREN */)) {
            do {
                if (args.length >= 255) {
                    this.error(this.peek(), "Functions may only have up to 255 arguments");
                }
                // calling `assignment` to ignore comma operator.
                args.push(this.expression());
            } while (this.match(4 /* COMMA */));
        }
        const end = this.consume(1 /* RIGHT_PAREN */, "Expected ')' after argument list");
        return new Ast.Expr.Call(callee, end, args);
    }
    primary() {
        if (this.match(27 /* FALSE */))
            return new Ast.Expr.Literal(false);
        if (this.match(37 /* TRUE */))
            return new Ast.Expr.Literal(true);
        if (this.match(31 /* NIL */))
            return new Ast.Expr.Literal(null);
        if (this.match(23 /* NUMBER */, 22 /* STRING */)) {
            return new Ast.Expr.Literal(this.previous().value);
        }
        if (this.match(36 /* THIS */)) {
            return new Ast.Expr.This(this.previous());
        }
        if (this.match(35 /* SUPER */)) {
            const keyword = this.previous();
            this.consume(5 /* DOT */, "Expected '.' after 'super'");
            const method = this.consume(21 /* IDENTIFIER */, "Expected property name");
            return new Ast.Expr.Super(keyword, method);
        }
        if (this.match(21 /* IDENTIFIER */)) {
            return new Ast.Expr.Variable(this.previous());
        }
        if (this.match(0 /* LEFT_PAREN */)) {
            const expr = this.comma();
            this.consume(1 /* RIGHT_PAREN */, "Unterminated ')'");
            return new Ast.Expr.Grouping(expr);
        }
        if (this.match(28 /* FUN */)) {
            let name = null;
            if (this.match(21 /* IDENTIFIER */)) {
                name = this.previous();
            }
            this.consume(0 /* LEFT_PAREN */, `Expected '(' in function declaration`);
            const params = [];
            if (!this.check(1 /* RIGHT_PAREN */)) {
                do {
                    if (params.length >= 255) {
                        this.error(this.peek(), "Functions may only have up to 255 parameters");
                    }
                    params.push(this.consume(21 /* IDENTIFIER */, "Expected parameter name"));
                } while (this.match(4 /* COMMA */));
            }
            this.consume(1 /* RIGHT_PAREN */, "Expected ')' after parameter list");
            this.consume(2 /* LEFT_BRACE */, `Expected '{' after function declaration`);
            const body = this.block();
            return new Ast.Expr.Function(name, params, body);
        }
        if (this.match(42 /* DELETE */)) {
            let inst = this.comma();
            if (inst.type === 10 /* Get */) {
                return new Ast.Expr.Delete(inst.object, inst.name);
            }
            else {
                throw this.error(this.peek(), "Delete expression must end with field access");
            }
        }
        throw this.error(this.peek(), "Expected expression");
    }
    synchronize() {
        this.advance();
        while (!this.isAtEnd) {
            if (this.previous().type === 8 /* SEMICOLON */)
                return;
            switch (this.peek().type) {
                case 25 /* CLASS */:
                case 28 /* FUN */:
                case 38 /* VAR */:
                case 29 /* FOR */:
                case 30 /* IF */:
                case 39 /* WHILE */:
                case 33 /* PRINT */:
                case 34 /* RETURN */:
                    return;
            }
            this.advance();
        }
    }
}
