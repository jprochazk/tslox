module.exports = {
    roots: ["<rootDir>/src", "<rootDir>/test"],
    transform: {
        "^.+\\.ts?$": "ts-jest",
    },
    testRegex: "(/__tests__/.*|(\\.|/)(test|spec))\\.ts?$",
    testEnvironment: "node",
    moduleFileExtensions: ["ts", "js"],
    moduleDirectories: ["node_modules", "src"],
};