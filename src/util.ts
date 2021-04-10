

export function panic(message: string): never {
    console.error(`PANIC: ${message}`);
    process.exit(1);
}