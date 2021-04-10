import fs from "fs";
import readline from "readline";
import { Lox } from "./src";
export { Lox };

function createPrompt(prefix: string) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    const prompt = (then: (input: string) => false | void) => {
        rl.question(prefix, answer => {
            if (then(answer) === false) {
                rl.close();
                return;
            }
            prompt(then);
        });
    };
    return prompt;
}

function main(args: string[]) {
    if (args.length > 1 || args.includes("--help") || args.includes("-h")) {
        console.log("Usage: lox <file>");
    } else if (args.length === 1) {
        console.log(`Running file ${args[0]}`);
        const lox = new Lox();
        lox.run(fs.readFileSync(args[0], "utf-8"));
    } else {
        console.log(`Lox REPL v0.1`);
        const lox = new Lox(true);
        const prompt = createPrompt("> ");
        prompt(input => lox.run(input));
    }
}

main(process.argv.slice(2));