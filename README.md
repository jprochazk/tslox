# lox

A TypeScript implementation of the `Lox` language from [Crafting Interpreters](http://craftinginterpreters.com/).

### Usage

Feel free to use your favorite Node package manager. I'm using Yarn:

Install:

```
yarn
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

Causing an error of any kind does not cause the interpreter to enter an invalid state, so you can just keep going:

```
> a
[line 1] Error: Undefined variable 'a'
    .... interpreter call stack
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

This should be a (mostly) standard implementation of `Lox`. There is no test suite, so there's a possibility some things are broken. At the very least, every example in the book should work.

There is one major difference, which is undefined property access does not throw an error, but returns `nil`:

```go
class Object {}
var obj = Object();
print obj.a; // prints: nil
```

The problem with throwing an error is that there is no way to know if a property exists before trying to access it. Returning `nil` allows you to check it. It creates a new problem, which is that there is no difference between a field with the value `nil` and a field that doesn't exist:

```go
class Object {}
var obj = Object();
print obj.a; // nil
obj.a = nil;
print obj.a; // also nil
```

My opinion is that this is more acceptable behavior than throwing an error. It could further be solved by adding a special type, `undefined`. This is what JavaScript does, and it would work well, if only JavaScript didn't also make the mistake of allowing users to assign the value `undefined` to something, which means that `undefined` doesn't really mean `undefined` and thus the problem persists.

I've also implemented some extra features on top of what's in the book (some of these are from the challenges in the book):

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
print obj.a; // prints: nil
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
