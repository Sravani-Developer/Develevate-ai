import type { Config } from "jest";

const config: Config = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: ".",
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    "^.+\\.(t|j)s$": "ts-jest"
  },
  moduleNameMapper: {
    "^@develevate/shared$": "<rootDir>/../../packages/shared/src"
  },
  collectCoverageFrom: ["src/**/*.(t|j)s"],
  testEnvironment: "node"
};

export default config;
