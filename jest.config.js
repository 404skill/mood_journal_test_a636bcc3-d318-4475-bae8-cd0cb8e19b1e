module.exports = {
  testRunner: "jest-circus/runner",
  setupFilesAfterEnv: ["jest-expect-message"],
  reporters: [
    "default",
    [
      "<rootDir>/reporters/custom-junit-reporter.js",
      {
        outputDirectory: "test-reports",
        outputName: "results.xml",
      },
    ],
  ],
};
