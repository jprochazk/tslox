import { Lox } from "../src";

describe("Lox native bindings", function () {
    it("bind function", function () {
        const test = jest.fn();

        const lox = new Lox();
        lox.func("test", test);
        lox.run("test();");

        expect(test).toBeCalled();
    });
});