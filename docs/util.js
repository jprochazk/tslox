export function panic(message) {
    this.ctx.logger.log(`PANIC: ${message}`);
    process.exit(1);
}
