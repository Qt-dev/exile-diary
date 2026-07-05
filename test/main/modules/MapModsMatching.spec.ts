jest.mock('electron-log', () => ({
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  scope: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
}));

const fs = jest.requireActual('node:fs');
const path = jest.requireActual('node:path');
const { matchMapMods } = require('../../../src/main/modules/ImageParser/matchMapMods');

describe('map mod matching pipeline', () => {
  const fixtureRoot = path.resolve(process.cwd(), 'test', 'Fixtures', 'migration-0', 'ocr');

  it('matches seeded OCR lines with confidence metadata', () => {
    const input = JSON.parse(
      fs.readFileSync(path.join(fixtureRoot, 'sample-mod-lines.json'), 'utf8')
    );
    const expected = JSON.parse(
      fs.readFileSync(path.join(fixtureRoot, 'sample-expected-mods.json'), 'utf8')
    );

    const result = matchMapMods(input);

    expect(result.status).toBe('ok');
    expect(result.matchedMods.map((match) => match.mod)).toEqual(expected);
    expect(result.matchedMods.every((match) => match.confidence > 0.5)).toBe(true);
    expect(result.diagnostics?.retryRecommended).toBe(false);
    expect(result.diagnostics?.thresholds?.minimumAverageConfidence).toBe(0.6);
  });

  it('marks sparse OCR matches as low-confidence and recommends a retry', () => {
    const input = JSON.parse(
      fs.readFileSync(path.join(fixtureRoot, 'low-confidence-mod-lines.json'), 'utf8')
    );
    const expected = JSON.parse(
      fs.readFileSync(path.join(fixtureRoot, 'low-confidence-expected.json'), 'utf8')
    );

    const result = matchMapMods(input);

    expect(result.status).toBe(expected.status);
    expect(result.diagnostics?.retryRecommended).toBe(expected.retryRecommended);
    expect(result.diagnostics?.retryReason).toBe(expected.retryReason);
    expect(result.matchedMods.map((match) => match.mod)).toContain(expected.expectedMatchedMod);
    expect(result.diagnostics?.matchedLineRatio).toBeLessThan(0.5);
    expect(result.diagnostics?.thresholds?.retryMatchedLineRatioThreshold).toBe(0.75);
  });
});
