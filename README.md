# lox

An implementation of the `Lox` language, from [this book](http://craftinginterpreters.com/).

### Usage

Install:

```
npm install
```

Start the interpreter in REPL mode:

```
yarn start
```

In REPL mode, you can either input an expression which will be evaluated and printed, or a statement which will be executed:

```
> 10 + 10
20
> var a = 10;
> print a;
10
```

Causing an error of any kind does not cause the interpreter to enter an invalid state:

```
> a
[line 1] Error: Undefined variable 'a'
    .... call stack
> var (a) = 10;
[line 1] Expected identifier after 'var' statement
```

Interpret a file:

```
yarn start <file path>
```

You can try this on the `hello.lox` file included in the root of the repository:

```
> yarn start hello.lox
Running file hello.lox
Hello, Lox!
```

### Features

On top of what `Lox` can already do, this implementation also provides:

The `**` (power) and `%` (modulo) operators:

```go
print 10 ** 2; // prints: 100
print 10 % 5;  // prints: 0
```

Static methods:

```go
class A { static test() { print "test"; } }
A.test(); // prints: "test"
```

```go
class A { static test() { print "test"; } }
class B < A { static test() { super.test(); } }
B.test(); // prints: "test"
```

```go
class A { static test() { print "test"; } }
class B < A { }
B.test(); // prints: "test"
```

Getters:

```go
class A {
    init() { this.value = 5; }
    large { return this.value > 10; }
}
var a = A();
print a.large;
a.value = 20;
print a.large;
```

Delete operator:

```go
class Object {}
var obj = Object();
obj.a = 10;
print obj.a; // prints: 10
delete obj.a;
print obj.a; // throws: Undefined property 'a'
```

```go
class Object { test() { print "test"; } }
var obj = Object();
obj.test(); // prints: "test"
// delete is an expression which returns 'true' if the property was deleted
// and 'false' if it wasn't or it didn't exist
print delete obj.test; // false
obj.test(); // prints: "test"
```

`break` and `continue` within loops:

```go
// prints:
// 0
// 1
// 3
// 4
for (var i = 0; i < 10; i = i + 1) {
    if (i == 2) continue;
    if (i == 5) break;
    print i;
}
```

```go
// it's an error to use outside of a loop
break; // error: Break statements are invalid outside of loops
```

Comma operator (JavaScript-like):

```go
// result of a comma expression is the last operand
var a = 0, 1;
print a; // prints: 1
// the comma operator is overloaded specifically for print statements
// where it prints all the operands, separated by a single space
print 0, 1, 2; // prints: "0 1 2"
// this only works when the print statement encounters a comma expression *directly*
print (0, 1, 2); // prints: 2
```

Warnings about unused local variables:

```go
var a = 0;
{
    var b = 10; // Warning: Unused local variable 'b'
}
```

Easy binding of JavaScript functions:

```ts
import { Lox } from "lox";

const lox = new Lox();
lox.func("myPrint", (v) => console.log(v));
lox.run('myPrint("hello!");'); // prints: hello!
```
