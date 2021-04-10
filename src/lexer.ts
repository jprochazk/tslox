import { Context } from "./ctx";
import { LoxError } from "./error";

export namespace Token {
    export const enum Type {
        // Single-character tokens.
        LEFT_PAREN, RIGHT_PAREN, LEFT_BRACE, RIGHT_BRACE,
        COMMA, DOT, MINUS, PLUS, SEMICOLON, SLASH, STAR,
        PERCENT,

        // One or two character tokens.
        BANG, BANG_EQUAL,
        EQUAL, EQUAL_EQUAL,
        GREATER, GREATER_EQUAL,
        LESS, LESS_EQUAL,
        POWER,

        // Literals.
        IDENTIFIER, STRING, NUMBER,

        // Keywords.
        AND, CLASS, ELSE, FALSE, FUN, FOR, IF, NIL, OR,
        PRINT, RETURN, SUPER, THIS, TRUE, VAR, WHILE,
        CONTINUE, BREAK, DELETE, STATIC,

        EOF
    }
}

export class Token {
    constructor(
        readonly type: Token.Type,
        readonly lexeme: string,
        readonly value: string | number | null,
        readonly line: number,
    ) { }

    toString() {
        return `Token(${this.type}, ${this.lexeme}, ${this.value})`
    }
    [Symbol.toStringTag]() {
        return "Token";
    }
}

export class Lexer {
    private tokens: Token[] = [];
    private current = 0;
    private line = 1;
    private source: string = "";
    constructor(
        private ctx: Context
    ) { }

    reset() {
        this.tokens = [];
        this.current = 0;
        this.line = 1;
        this.source = "";
    }

    private advance(): string {
        return this.source.charAt(this.current++);
    }

    private peek(ahead: number = 0): string {
        const pos = this.current + ahead;
        if (pos >= this.source.length) return "\0";
        return this.source.charAt(pos);
    }

    private match(expected: string): boolean {
        if (this.isAtEnd) return false;
        if (this.source.charAt(this.current) != expected) return false;

        this.advance();
        return true;
    }

    private get isAtEnd(): boolean {
        return this.current >= this.source.length;
    }

    public tokenize(source: string): Token[] {
        this.source = source;
        next: while (!this.isAtEnd) {
            let start = this.current;
            let type!: Token.Type;
            let value = null;
            let char = this.advance();
            switch (char) {
                // single-char tokens
                case '(': type = Token.Type.LEFT_PAREN; break;
                case ')': type = Token.Type.RIGHT_PAREN; break;
                case '{': type = Token.Type.LEFT_BRACE; break;
                case '}': type = Token.Type.RIGHT_BRACE; break;
                case ',': type = Token.Type.COMMA; break;
                case '.': type = Token.Type.DOT; break;
                case '-': type = Token.Type.MINUS; break;
                case '+': type = Token.Type.PLUS; break;
                case ';': type = Token.Type.SEMICOLON; break;
                case '%': type = Token.Type.PERCENT; break;

                // two-char tokens
                case '/': {
                    // single-line comments start with `//`
                    if (this.match('/')) {
                        // consume tokens until new line
                        while (this.peek() !== '\n' && !this.isAtEnd) this.advance();
                        continue next;
                    }
                    type = Token.Type.SLASH;
                    break;
                }
                case '*': {
                    // power op is '**'
                    if (this.match('*')) {
                        type = Token.Type.POWER; break;
                    } else {
                        type = Token.Type.STAR; break;
                    }
                }
                case '!': type = this.match('=') ? Token.Type.BANG_EQUAL : Token.Type.BANG; break;
                case '=': type = this.match('=') ? Token.Type.EQUAL_EQUAL : Token.Type.EQUAL; break;
                case '<': type = this.match('=') ? Token.Type.LESS_EQUAL : Token.Type.LESS; break;
                case '>': type = this.match('=') ? Token.Type.GREATER_EQUAL : Token.Type.GREATER; break;

                // whitespace
                case ' ': /* fallthrough */
                case '\r': /* fallthrough */
                case '\t': continue next;

                // newline
                case '\n': ++this.line; continue next;

                // string literal
                case '\'': /* fallthrough */
                case '\"': {
                    // consume the contained and newlines
                    while (this.peek() != '"' && !this.isAtEnd) {
                        if (this.peek() == '\n') ++this.line;
                        this.advance();
                    }

                    if (this.isAtEnd) {
                        this.ctx.error(new LoxError(this.line,
                            "Unterminated string"));
                    }

                    // consume closing quote
                    this.advance();

                    // trim quotes
                    value = this.source.substring(start + 1, this.current - 1);
                    type = Token.Type.STRING;

                    break;
                }

                default: {
                    switch (true) {
                        case isDigit(char): {
                            while (isDigit(this.peek())) this.advance();

                            if (this.peek() == '.' && isDigit(this.peek(1))) {
                                this.advance();

                                while (isDigit(this.peek())) this.advance();
                            }

                            type = Token.Type.NUMBER;
                            value = parseFloat(this.source.substring(start, this.current));
                            break;
                        }
                        case isAlpha(char): {
                            while (isAlphaNumeric(this.peek())) this.advance();

                            type = KEYWORDS[this.source.substring(start, this.current)] ?? Token.Type.IDENTIFIER;
                            break;
                        }
                        default: {
                            this.ctx.error(new LoxError(this.line,
                                "Unexpected character"));
                            continue next;
                        }
                    }
                }
            }

            const lexeme = this.source.substring(start, this.current);
            this.tokens.push(new Token(type, lexeme, value, this.line));
        }

        this.tokens.push(new Token(Token.Type.EOF, "", null, this.line));
        return this.tokens;
    }
}

const CHAR_CODES = Object.freeze({
    ZERO: '0'.charCodeAt(0),
    NINE: '9'.charCodeAt(0),
    'a': 'a'.charCodeAt(0),
    'A': 'A'.charCodeAt(0),
    'z': 'z'.charCodeAt(0),
    'Z': 'Z'.charCodeAt(0),
    '_': '_'.charCodeAt(0),
});

function isDigit(char: string) {
    let cc = char.charCodeAt(0);
    return (cc >= CHAR_CODES.ZERO && cc <= CHAR_CODES.NINE);
}

function isAlpha(char: string) {
    let cc = char.charCodeAt(0);
    return (cc >= CHAR_CODES.a && cc <= CHAR_CODES.z)
        || (cc >= CHAR_CODES.A && cc <= CHAR_CODES.Z)
        || cc == CHAR_CODES._;
}

function isAlphaNumeric(char: string) {
    let cc = char.charCodeAt(0);
    return (cc >= CHAR_CODES.ZERO && cc <= CHAR_CODES.NINE)
        || (cc >= CHAR_CODES.a && cc <= CHAR_CODES.z)
        || (cc >= CHAR_CODES.A && cc <= CHAR_CODES.Z)
        || (cc == CHAR_CODES._);
}

const KEYWORDS: Record<string, number> = Object.freeze({
    "and": Token.Type.AND,
    "class": Token.Type.CLASS,
    "else": Token.Type.ELSE,
    "false": Token.Type.FALSE,
    "for": Token.Type.FOR,
    "fun": Token.Type.FUN,
    "if": Token.Type.IF,
    "nil": Token.Type.NIL,
    "or": Token.Type.OR,
    "print": Token.Type.PRINT,
    "return": Token.Type.RETURN,
    "super": Token.Type.SUPER,
    "this": Token.Type.THIS,
    "true": Token.Type.TRUE,
    "var": Token.Type.VAR,
    "while": Token.Type.WHILE,
    "continue": Token.Type.CONTINUE,
    "break": Token.Type.BREAK,
    "delete": Token.Type.DELETE,
    "static": Token.Type.STATIC
});
