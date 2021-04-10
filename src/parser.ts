import { Context } from "./ctx";
import { Token } from "./lexer";
import * as Ast from "./ast";

export class ParseError extends Error { }

export class Parser {
    private current = 0;
    private tokens: Token[] = [];
    constructor(
        readonly ctx: Context
    ) { }

    reset() {
        this.current = 0;
        this.tokens = [];
    }

    public parse(tokens: Token[]): Ast.Stmt[] {
        this.tokens = tokens;
        const stmts: Ast.Stmt[] = [];
        while (!this.isAtEnd) {
            const decl = this.declaration();
            if (decl) stmts.push(decl);
        }
        return stmts;
    }

    private previous(): Token {
        return this.tokens[this.current - 1];
    }

    private peek(): Token {
        return this.tokens[this.current];
    }

    private get isAtEnd(): boolean {
        return this.tokens.length === 0 || this.peek() === undefined || this.peek().type === Token.Type.EOF;
    }

    private advance(): Token {
        if (!this.isAtEnd) ++this.current;
        return this.previous();
    }

    private check(type: Token.Type): boolean {
        if (this.isAtEnd) return false;
        return this.peek().type === type;
    }

    private match(...types: Token.Type[]): boolean {
        for (let i = 0; i < types.length; ++i) {
            if (this.check(types[i])) {
                this.advance();
                return true;
            }
        }

        return false;
    }

    private consume(type: Token.Type, message: string): Token {
        if (this.check(type)) return this.advance();
        throw this.error(this.peek(), message);
    }

    private error(token: Token, message: string): ParseError {
        this.ctx.error(token, message);
        return new ParseError();
    }

    // PARSING
    private declaration(): Ast.Stmt | null {
        try {
            if (this.match(Token.Type.CLASS)) return this.classDeclaration();
            if (this.match(Token.Type.FUN)) return this.functionDeclaration("function");
            if (this.match(Token.Type.VAR)) return this.varDeclaration();

            return this.statement();
        } catch (error: unknown) {
            if (error instanceof ParseError) {
                this.synchronize();
                return null;
            } else {
                throw error;
            }
        }
    }

    private classDeclaration(): Ast.Stmt.Class {
        const name = this.consume(Token.Type.IDENTIFIER, `Expected class name`);

        let superclass: Ast.Expr.Variable | null = null;
        if (this.match(Token.Type.LESS)) {
            const name = this.consume(Token.Type.IDENTIFIER, "Expected superclass name");
            superclass = new Ast.Expr.Variable(name);
        }

        this.consume(Token.Type.LEFT_BRACE, `Expected '{' after class name`);

        const methods = [];
        const staticMethods = [];
        while (!this.check(Token.Type.RIGHT_BRACE) && !this.isAtEnd) {
            const isStatic = this.match(Token.Type.STATIC);
            const decl = this.functionDeclaration("method");
            if (isStatic) staticMethods.push(decl);
            else methods.push(decl);
        }
        this.consume(Token.Type.RIGHT_BRACE, `Expected '}' after class body`);

        return new Ast.Stmt.Class(name, superclass, methods, staticMethods);
    }

    private functionDeclaration(kind: "function" | "method"): Ast.Stmt.Function {
        const name = this.consume(Token.Type.IDENTIFIER, `Expected ${kind} name`);

        let params: Token[] | null = null;
        if (this.match(Token.Type.LEFT_PAREN)) {
            // function/method
            params = [];
            if (!this.check(Token.Type.RIGHT_PAREN)) {
                do {
                    if (params.length >= 255) {
                        this.error(this.peek(), "Functions may only have up to 255 parameters");
                    }

                    params.push(this.consume(Token.Type.IDENTIFIER, "Expected parameter name"));
                } while (this.match(Token.Type.COMMA))
            }
            this.consume(Token.Type.RIGHT_PAREN, "Expected ')' after parameter list");
        }
        this.consume(Token.Type.LEFT_BRACE, `Expected '{' after ${kind} declaration`);
        const body = this.block();
        if (kind === "function" && params === null) {
            this.error(this.peek(), "Getters may only exist within a class");
        }
        return new Ast.Stmt.Function(name, params, body);
    }

    private varDeclaration(): Ast.Stmt.Var {
        const name = this.consume(Token.Type.IDENTIFIER, "Expected identifier after 'var' statement");

        let init;
        if (this.match(Token.Type.EQUAL)) {
            init = this.comma();
        }

        this.consume(Token.Type.SEMICOLON, "Statements must be terminated by semicolons");
        return new Ast.Stmt.Var(name, init);
    }

    private statement(): Ast.Stmt {
        if (this.match(Token.Type.IF)) return this.ifStatement();
        if (this.match(Token.Type.PRINT)) return this.printStatement();
        if (this.match(Token.Type.RETURN)) return this.returnStatement();
        if (this.match(Token.Type.WHILE)) return this.whileStatement();
        if (this.match(Token.Type.FOR)) return this.forStatement();
        if (this.match(Token.Type.BREAK)) return this.breakStatement();
        if (this.match(Token.Type.CONTINUE)) return this.continueStatement();
        if (this.match(Token.Type.LEFT_BRACE)) return new Ast.Stmt.Block(this.block());

        return this.expressionStatement();
    }

    private block(): Ast.Stmt[] {
        const stmtList: Ast.Stmt[] = [];

        while (!this.check(Token.Type.RIGHT_BRACE) && !this.isAtEnd) {
            const decl = this.declaration();
            if (decl) stmtList.push(decl);
        }

        this.consume(Token.Type.RIGHT_BRACE, "Expected '}' after block");
        return stmtList;
    }

    private ifStatement(): Ast.Stmt.If {
        this.consume(Token.Type.LEFT_PAREN, "Expected '(' after 'if'");
        const condition = this.comma();
        this.consume(Token.Type.RIGHT_PAREN, "Expected ')' after if condition");

        const thenBranch = this.statement();
        let elseBranch = null;
        if (this.match(Token.Type.ELSE)) {
            elseBranch = this.statement();
        }

        return new Ast.Stmt.If(condition, thenBranch, elseBranch);
    }

    private printStatement(): Ast.Stmt.Print {
        const expr = this.comma();
        this.consume(Token.Type.SEMICOLON, "Statements must be terminated by semicolons");
        return new Ast.Stmt.Print(expr);
    }

    private returnStatement(): Ast.Stmt.Return {
        const keyword = this.previous();
        let value = null;
        if (!this.check(Token.Type.SEMICOLON)) {
            value = this.comma();
        }

        this.consume(Token.Type.SEMICOLON, "Statements must be terminated by semicolons");
        return new Ast.Stmt.Return(keyword, value);
    }

    private whileStatement(): Ast.Stmt.Loop {
        this.consume(Token.Type.LEFT_PAREN, "Expected '(' after 'while'");
        const condition = this.comma();
        this.consume(Token.Type.RIGHT_PAREN, "Expected ')' after loop condition");
        const body = this.statement();

        return new Ast.Stmt.Loop(null, condition, null, body);
    }

    private forStatement(): Ast.Stmt.Loop | Ast.Stmt.Block {
        this.consume(Token.Type.LEFT_PAREN, "Expected '(' after 'for'");

        let init: Ast.Stmt | null;
        if (this.match(Token.Type.SEMICOLON)) {
            init = null;
        } else if (this.match(Token.Type.VAR)) {
            init = this.varDeclaration() as Ast.Stmt;
        } else {
            init = this.expressionStatement() as Ast.Stmt;
        }
        let condition = null;
        if (!this.check(Token.Type.SEMICOLON)) {
            condition = this.comma();
        }
        this.consume(Token.Type.SEMICOLON, "Expected ';' after loop condition");
        let update = null;
        if (!this.check(Token.Type.RIGHT_PAREN)) {
            update = this.comma();
        }
        this.consume(Token.Type.RIGHT_PAREN, "Expected ')' after loop clauses");
        let body = this.statement();

        if (condition === null) condition = new Ast.Expr.Literal(true);
        return new Ast.Stmt.Loop(init, condition, update, body);
    }

    private breakStatement(): Ast.Stmt.Break {
        const keyword = this.previous();
        this.consume(Token.Type.SEMICOLON, "Statements must be terminated by semicolons");
        return new Ast.Stmt.Break(keyword);
    }

    private continueStatement(): Ast.Stmt.Continue {
        const keyword = this.previous();
        this.consume(Token.Type.SEMICOLON, "Statements must be terminated by semicolons");
        return new Ast.Stmt.Continue(keyword);
    }

    private expressionStatement(): Ast.Stmt.Expression {
        const expr = this.comma();
        this.consume(Token.Type.SEMICOLON, "Statements must be terminated by semicolons");
        return new Ast.Stmt.Expression(expr);
    }

    private comma(): Ast.Expr {
        const list = [this.expression()];
        while (this.match(Token.Type.COMMA)) {
            list.push(this.expression());
        }

        if (list.length > 1) {
            return new Ast.Expr.Comma(list);
        } else {
            return list[0];
        }
    }

    private expression(): Ast.Expr {
        return this.assignment();
    }

    private assignment(): Ast.Expr {
        const expr = this.or();

        if (this.match(Token.Type.EQUAL)) {
            const equals = this.previous();
            const value = this.assignment();

            if (expr instanceof Ast.Expr.Variable) {
                const name = expr.name;
                return new Ast.Expr.Assign(name, value);
            } else if (expr instanceof Ast.Expr.Get) {
                return new Ast.Expr.Set(expr.object, expr.name, value);
            }

            this.error(equals, "Invalid assignment target");
        }

        return expr;
    }

    private or(): Ast.Expr {
        let expr = this.and();

        while (this.match(Token.Type.OR)) {
            const op = this.previous();
            const right = this.and();
            expr = new Ast.Expr.Logical(expr, op, right);
        }

        return expr;
    }

    private and(): Ast.Expr {
        let expr = this.equality();

        while (this.match(Token.Type.AND)) {
            const op = this.previous();
            const right = this.equality();
            expr = new Ast.Expr.Logical(expr, op, right);
        }

        return expr;
    }

    private equality(): Ast.Expr {
        let expr = this.comparison();

        while (this.match(
            Token.Type.BANG_EQUAL,
            Token.Type.EQUAL_EQUAL
        )) {
            const op = this.previous();
            const right = this.comparison();
            expr = new Ast.Expr.Binary(expr, op, right);
        }

        return expr;
    }

    private comparison(): Ast.Expr {
        let expr = this.term();

        while (this.match(
            Token.Type.GREATER,
            Token.Type.GREATER_EQUAL,
            Token.Type.LESS,
            Token.Type.LESS_EQUAL
        )) {
            const op = this.previous();
            const right = this.term();
            expr = new Ast.Expr.Binary(expr, op, right);
        }

        return expr;
    }

    private term(): Ast.Expr {
        let expr = this.factor();

        while (this.match(
            Token.Type.MINUS,
            Token.Type.PLUS
        )) {
            const op = this.previous();
            const right = this.factor();
            expr = new Ast.Expr.Binary(expr, op, right);
        }

        return expr;
    }

    private factor(): Ast.Expr {
        let expr = this.power();

        while (this.match(
            Token.Type.SLASH,
            Token.Type.STAR,
            Token.Type.PERCENT
        )) {
            const op = this.previous();
            const right = this.power();
            expr = new Ast.Expr.Binary(expr, op, right);
        }

        return expr;
    }

    private power(): Ast.Expr {
        let expr = this.unary();

        while (this.match(Token.Type.POWER)) {
            const op = this.previous();
            const right = this.power();
            expr = new Ast.Expr.Binary(expr, op, right);
        }

        return expr;
    }

    private unary(): Ast.Expr {
        if (this.match(
            Token.Type.BANG,
            Token.Type.MINUS
        )) {
            const op = this.previous();
            const right = this.unary();
            return new Ast.Expr.Unary(op, right);
        }

        return this.call();
    }

    private call(): Ast.Expr {
        let expr = this.primary();

        for (; ;) {
            if (this.match(Token.Type.LEFT_PAREN)) {
                expr = this.finishCall(expr);
            } else if (this.match(Token.Type.DOT)) {
                const name = this.consume(Token.Type.IDENTIFIER, "Expected property name after '.'");
                expr = new Ast.Expr.Get(expr, name);
            } else {
                break;
            }
        }

        return expr;
    }

    private finishCall(callee: Ast.Expr): Ast.Expr {
        const args = [];
        if (!this.check(Token.Type.RIGHT_PAREN)) {
            do {
                if (args.length >= 255) {
                    this.error(this.peek(), "Functions may only have up to 255 arguments");
                }
                // calling `assignment` to ignore comma operator.
                args.push(this.expression());
            } while (this.match(Token.Type.COMMA))
        }
        const end = this.consume(Token.Type.RIGHT_PAREN, "Expected ')' after argument list");

        return new Ast.Expr.Call(callee, end, args);
    }

    private primary(): Ast.Expr {
        if (this.match(Token.Type.FALSE)) return new Ast.Expr.Literal(false);
        if (this.match(Token.Type.TRUE)) return new Ast.Expr.Literal(true);
        if (this.match(Token.Type.NIL)) return new Ast.Expr.Literal(null);

        if (this.match(Token.Type.NUMBER, Token.Type.STRING)) {
            return new Ast.Expr.Literal(this.previous().value);
        }

        if (this.match(Token.Type.THIS)) {
            return new Ast.Expr.This(this.previous());
        }

        if (this.match(Token.Type.SUPER)) {
            const keyword = this.previous();
            this.consume(Token.Type.DOT, "Expected '.' after 'super'");
            const method = this.consume(Token.Type.IDENTIFIER, "Expected property name");
            return new Ast.Expr.Super(keyword, method)
        }

        if (this.match(Token.Type.IDENTIFIER)) {
            return new Ast.Expr.Variable(this.previous());
        }

        if (this.match(Token.Type.LEFT_PAREN)) {
            const expr = this.comma();
            this.consume(Token.Type.RIGHT_PAREN, "Unterminated ')'");
            return new Ast.Expr.Grouping(expr);
        }

        if (this.match(Token.Type.FUN)) {
            let name = null;
            if (this.match(Token.Type.IDENTIFIER)) {
                name = this.previous();
            }
            this.consume(Token.Type.LEFT_PAREN, `Expected '(' in function declaration`);
            const params = [];
            if (!this.check(Token.Type.RIGHT_PAREN)) {
                do {
                    if (params.length >= 255) {
                        this.error(this.peek(), "Functions may only have up to 255 parameters");
                    }

                    params.push(this.consume(Token.Type.IDENTIFIER, "Expected parameter name"));
                } while (this.match(Token.Type.COMMA))
            }
            this.consume(Token.Type.RIGHT_PAREN, "Expected ')' after parameter list");

            this.consume(Token.Type.LEFT_BRACE, `Expected '{' after function declaration`);
            const body = this.block();
            return new Ast.Expr.Function(name, params, body);
        }

        if (this.match(Token.Type.DELETE)) {
            let inst = this.comma();
            if (inst.type === Ast.Expr.Type.Get) {
                return new Ast.Expr.Delete(inst.object, inst.name);
            } else {
                throw this.error(this.peek(), "Delete expression must end with field access");
            }
        }

        throw this.error(this.peek(), "Expected expression");
    }

    private synchronize(): void {
        this.advance();

        while (!this.isAtEnd) {
            if (this.previous().type === Token.Type.SEMICOLON) return;

            switch (this.peek().type) {
                case Token.Type.CLASS:
                case Token.Type.FUN:
                case Token.Type.VAR:
                case Token.Type.FOR:
                case Token.Type.IF:
                case Token.Type.WHILE:
                case Token.Type.PRINT:
                case Token.Type.RETURN:
                    return;
            }

            this.advance();
        }
    }
}