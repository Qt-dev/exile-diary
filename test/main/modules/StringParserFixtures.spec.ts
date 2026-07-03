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
const StringParser = require('../../../src/main/modules/StringParser/StringParser').default;

describe('StringParser migration fixtures', () => {
  const fixtureRoot = path.resolve(process.cwd(), 'test', 'Fixtures', 'migration-0', 'ocr');

  it('matches the seeded OCR fixture lines', () => {
    const inputPath = path.join(fixtureRoot, 'sample-mod-lines.json');
    const expectedPath = path.join(fixtureRoot, 'sample-expected-mods.json');
    const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    const expected = JSON.parse(fs.readFileSync(expectedPath, 'utf8'));

    expect(StringParser.GetMods(input)).toEqual(expected);
  });
});
