const fs = jest.requireActual('node:fs');
const path = jest.requireActual('node:path');

describe('Migration 0 fixture manifest', () => {
  const fixtureRoot = path.resolve(process.cwd(), 'test', 'Fixtures', 'migration-0');
  const manifestPath = path.join(fixtureRoot, 'manifest.json');

  it('references files that exist on disk', () => {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const fixtureEntries = Object.values(manifest.fixtures).flat() as Array<Record<string, string>>;

    expect(fixtureEntries.length).toBeGreaterThan(0);

    for (const entry of fixtureEntries) {
      for (const relativePath of Object.values(entry)) {
        const absolutePath = path.join(fixtureRoot, relativePath);
        expect(fs.existsSync(absolutePath)).toBe(true);
      }
    }
  });
});
