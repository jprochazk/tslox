import { LoxError } from "./error.js";
export class Token {
    constructor(type, lexeme, value, line) {
        this.type = type;
        this.lexeme = lexeme;
        this.value = value;
        this.line = line;
    }
    toString() {
        return `Token(${this.type}, ${this.lexeme}, ${this.value})`;
    }
    [Symbol.toStringTag]() {
        return "Token";
    }
}
export class Lexer {
    constructor(ctx) {
        this.ctx = ctx;
        this.tokens = [];
        this.current = 0;
        this.line = 1;
        this.source = "";
    }
    reset() {
        this.tokens = [];
        this.current = 0;
        this.line = 1;
        this.source = "";
    }
    advance() {
        return this.source.charAt(this.current++);
    }
    peek(ahead = 0) {
        const pos = this.current + ahead;
        if (pos >= this.source.length)
            return "\0";
        return this.source.charAt(pos);
    }
    match(expected) {
        if (this.isAtEnd)
            return false;
        if (this.source.charAt(this.current) != expected)
            return false;
        this.advance();
        return true;
    }
    get isAtEnd() {
        return this.current >= this.source.length;
    }
    tokenize(source) {
        this.source = source;
        next: while (!this.isAtEnd) {
            let start = this.current;
            let type;
            let value = null;
            let char = this.advance();
            switch (char) {
                // single-char tokens
                case '(':
                    type = 0 /* LEFT_PAREN */;
                    break;
                case ')':
                    type = 1 /* RIGHT_PAREN */;
                    break;
                case '{':
                    type = 2 /* LEFT_BRACE */;
                    break;
                case '}':
                    type = 3 /* RIGHT_BRACE */;
                    break;
                case ',':
                    type = 4 /* COMMA */;
                    break;
                case '.':
                    type = 5 /* DOT */;
                    break;
                case '-':
                    type = 6 /* MINUS */;
                    break;
                case '+':
                    type = 7 /* PLUS */;
                    break;
                case ';':
                    type = 8 /* SEMICOLON */;
                    break;
                case '%':
                    type = 11 /* PERCENT */;
                    break;
                // two-char tokens
                case '/': {
                    // single-line comments start with `//`
                    if (this.match('/')) {
                        // consume tokens until new line
                        while (this.peek() !== '\n' && !this.isAtEnd)
                            this.advance();
                        continue next;
                    }
                    type = 9 /* SLASH */;
                    break;
                }
                case '*': {
                    // power op is '**'
                    if (this.match('*')) {
                        type = 20 /* POWER */;
                        break;
                    }
                    else {
                        type = 10 /* STAR */;
                        break;
                    }
                }
                case '!':
                    type = this.match('=') ? 13 /* BANG_EQUAL */ : 12 /* BANG */;
                    break;
                case '=':
                    type = this.match('=') ? 15 /* EQUAL_EQUAL */ : 14 /* EQUAL */;
                    break;
                case '<':
                    type = this.match('=') ? 19 /* LESS_EQUAL */ : 18 /* LESS */;
                    break;
                case '>':
                    type = this.match('=') ? 17 /* GREATER_EQUAL */ : 16 /* GREATER */;
                    break;
                // whitespace
                case ' ': /* fallthrough */
                case '\r': /* fallthrough */
                case '\t': continue next;
                // newline
                case '\n':
                    ++this.line;
                    continue next;
                // string literal
                case '\'': /* fallthrough */
                case '\"': {
                    // consume the contained and newlines
                    while (this.peek() != '"' && !this.isAtEnd) {
                        if (this.peek() == '\n')
                            ++this.line;
                        this.advance();
                    }
                    if (this.isAtEnd) {
                        this.ctx.error(new LoxError(this.line, "Unterminated string"));
                    }
                    // consume closing quote
                    this.advance();
                    // trim quotes
                    value = this.source.substring(start + 1, this.current - 1);
                    type = 22 /* STRING */;
                    break;
                }
                default: {
                    switch (true) {
                        case isDigit(char): {
                            while (isDigit(this.peek()))
                                this.advance();
                            if (this.peek() == '.' && isDigit(this.peek(1))) {
                                this.advance();
                                while (isDigit(this.peek()))
                                    this.advance();
                            }
                            type = 23 /* NUMBER */;
                            value = parseFloat(this.source.substring(start, this.current));
                            break;
                        }
                        case isAlpha(char): {
                            while (isAlphaNumeric(this.peek()))
                                this.advance();
                            type = KEYWORDS[this.source.substring(start, this.current)] ?? 21 /* IDENTIFIER */;
                            break;
                        }
                        default: {
                            this.ctx.error(new LoxError(this.line, "Unexpected character"));
                            continue next;
                        }
                    }
                }
            }
            const lexeme = this.source.substring(start, this.current);
            this.tokens.push(new Token(type, lexeme, value, this.line));
        }
        this.tokens.push(new Token(44 /* EOF */, "", null, this.line));
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
function isDigit(char) {
    let cc = char.charCodeAt(0);
    return (cc >= CHAR_CODES.ZERO && cc <= CHAR_CODES.NINE);
}
function isAlpha(char) {
    let cc = char.charCodeAt(0);
    return (cc >= CHAR_CODES.a && cc <= CHAR_CODES.z)
        || (cc >= CHAR_CODES.A && cc <= CHAR_CODES.Z)
        || cc == CHAR_CODES._;
}
function isAlphaNumeric(char) {
    let cc = char.charCodeAt(0);
    return (cc >= CHAR_CODES.ZERO && cc <= CHAR_CODES.NINE)
        || (cc >= CHAR_CODES.a && cc <= CHAR_CODES.z)
        || (cc >= CHAR_CODES.A && cc <= CHAR_CODES.Z)
        || (cc == CHAR_CODES._);
}
const KEYWORDS = Object.freeze({
    "and": 24 /* AND */,
    "class": 25 /* CLASS */,
    "else": 26 /* ELSE */,
    "false": 27 /* FALSE */,
    "for": 29 /* FOR */,
    "fun": 28 /* FUN */,
    "if": 30 /* IF */,
    "nil": 31 /* NIL */,
    "or": 32 /* OR */,
    "print": 33 /* PRINT */,
    "return": 34 /* RETURN */,
    "super": 35 /* SUPER */,
    "this": 36 /* THIS */,
    "true": 37 /* TRUE */,
    "var": 38 /* VAR */,
    "while": 39 /* WHILE */,
    "continue": 40 /* CONTINUE */,
    "break": 41 /* BREAK */,
    "delete": 42 /* DELETE */,
    "static": 43 /* STATIC */
});
