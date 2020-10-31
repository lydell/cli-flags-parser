const requireCoverage = {
  branches: 100,
  functions: 100,
  lines: 100,
  statements: 100,
};

const ignoreCoverage = {
  branches: 0,
  functions: 0,
  lines: 0,
  statements: 0,
};

module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  collectCoverageFrom: ["index.ts"],
  coverageThreshold: {
    global: process.platform === "win32" ? ignoreCoverage : requireCoverage,
  },
};
