module.exports = {
  preset: "jest-expo",
  roots: ["<rootDir>/tests"],
  testMatch: ["**/*.integration.test.tsx"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  setupFilesAfterEnv: ["<rootDir>/tests/jest.setup.ts"],
};
