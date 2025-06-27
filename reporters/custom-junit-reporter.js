const fs = require('fs');
const os = require('os');
const path = require('path');
const { create } = require('xmlbuilder2');

class CustomJunitReporter {
  constructor(globalConfig, options) {
    this._globalConfig = globalConfig;
    this._options = options || {};
    this._outputDir = this._options.outputDirectory || 'test-reports';
    this._outputFile = this._options.outputName || 'custom-results.xml';
  }

  onRunComplete(contexts, results) {
    const totalTimeSecs = ((Date.now() - results.startTime) / 1000).toFixed(3);
    const root = create({ version: '1.0', encoding: 'UTF-8' })
      .ele('testsuites', {
        name: 'jest tests',
        tests: results.numTotalTests,
        failures: results.numFailedTests,
        errors: 0,
        time: totalTimeSecs,
        timestamp: new Date(results.startTime).toISOString(),
        hostname: os.hostname()
      });

    for (const suite of results.testResults) {
      const suiteTime = ((suite.perfStats.end - suite.perfStats.start) / 1000).toFixed(3);
      const suiteEle = root.ele('testsuite', {
        name: suite.name,
        errors: 0,
        failures: suite.numFailingTests,
        skipped: suite.numPendingTests,
        timestamp: new Date(suite.perfStats.start).toISOString(),
        time: suiteTime,
        tests: suite.numPassingTests + suite.numFailingTests + suite.numPendingTests
      });

      for (const assertion of suite.testResults) {
        const classname = assertion.ancestorTitles.join(' › ') || path.basename(assertion.location.file || '');
        const name = assertion.title;
        const time = (assertion.duration != null ? (assertion.duration / 1000).toFixed(3) : '0.000');
        const tc = suiteEle.ele('testcase', { classname, name, time });

        if (assertion.status === 'failed') {
          const fullMsg = assertion.failureMessages.join('\n');
          const firstLine = fullMsg.split('\n', 1)[0];
          tc.ele('failure', { message: firstLine }).txt(fullMsg).up();
        }

        tc.up();
      }

      suiteEle.up();
    }

    const xml = root.end({ prettyPrint: true });
    if (!fs.existsSync(this._outputDir)) {
      fs.mkdirSync(this._outputDir, { recursive: true });
    }
    fs.writeFileSync(path.join(this._outputDir, this._outputFile), xml, 'utf-8');
  }
}

module.exports = CustomJunitReporter;
