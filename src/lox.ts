import { Context } from "./ctx";
import { Interpreter, makefn, Value } from "./interpreter";
import { Lexer } from "./lexer";
import { Parser } from "./parser";
import { Resolver } from "./resolver";

export type LoxFunction = (...args: Value[]) => Value | undefined | void;

export class Lox {
    private context: Context;
    private interpreter: Interpreter;
    private lexer: Lexer;
    private parser: Parser;
    private resolver: Resolver;

    constructor(
        public repl: boolean = false
    ) {
        this.context = new Context;
        this.interpreter = new Interpreter(this.context);
        this.lexer = new Lexer(this.context);
        this.parser = new Parser(this.context);
        this.resolver = new Resolver(this.context, this.interpreter);
    }

    public func(name: string, fn: LoxFunction) {
        this.globals().define(makefn(name, fn.length, (_, args) => fn(...args) as any ?? null));
    }

    public globals() {
        return this.interpreter.globals;
    }

    private reset(report = true) {
        if (report) this.context.reportAndReset();
        else this.context.reset();
        this.lexer.reset();
        this.parser.reset();
        this.resolver.reset();
    }

    private get hadError() {
        return this.context.hadError;
    }

    run(input: string): false | void {
        if (!this.repl) {
            const tokens = this.lexer.tokenize(input);
            if (this.hadError) return this.reset();
            const stmtList = this.parser.parse(tokens);
            if (this.hadError) return this.reset();
            this.resolver.run(stmtList);
            if (this.hadError) return this.reset();
            this.interpreter.interpret(stmtList);
            this.reset();
        } else {
            // in a REPL, we may receive an expression instead of a statement
            // which should be evaluated and printed
            input = input.trim();
            if (input === "exit") {
                return false;
            }
            // doesnt end with a semicolon = not a statement
            // treat is as an expression (wrap it in `print ;`)
            const tokens = this.lexer.tokenize(input);
            if (this.hadError) return this.reset();
            let stmtList = this.parser.parse(tokens);
            if (this.hadError) {
                const lastChar = input.substr(-1);
                if (lastChar !== ";" && lastChar !== "}") {
                    // try to re-tokenize and re-parse as an expression
                    // inside an implicit `print` statement
                    input = `print ${input};`;
                    // store previous errors and in case we fail again, report these instead
                    const previousErrors = this.context.errors;
                    this.reset(false);

                    const tokens = this.lexer.tokenize(input);
                    if (this.hadError) {
                        this.context.errors = previousErrors;
                        return this.reset();
                    }
                    stmtList = this.parser.parse(tokens);
                    if (this.hadError) {
                        this.context.errors = previousErrors;
                        return this.reset();
                    }
                } else {
                    return this.reset();
                }
            }
            this.resolver.run(stmtList);
            if (this.hadError) return this.reset();
            this.interpreter.interpret(stmtList);
            this.reset();
        }
    }
}