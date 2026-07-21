const fs = jest.requireActual('node:fs') as typeof import('node:fs');
const path = jest.requireActual('node:path') as typeof import('node:path');

import { parseClientLogFixture } from '../../../src/main/runtime-core/fixtures/parseClientLogFixture';
import { priceFixtureItems } from '../../../src/main/runtime-core/fixtures/priceFixtureItems';
import { valueFixtureStash } from '../../../src/main/runtime-core/fixtures/valueFixtureStash';

describe('RuntimeCore fixture regressions', () => {
  const fixtureRoot = path.resolve(process.cwd(), 'test', 'Fixtures', 'migration-0');
  const manifestPath = path.join(fixtureRoot, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  it('reconstructs seeded run events from captured client log slices', () => {
    const fixture = manifest.fixtures.runReconstruction[0];
    const input = fs.readFileSync(path.join(fixtureRoot, fixture.input), 'utf8');
    const expected = JSON.parse(fs.readFileSync(path.join(fixtureRoot, fixture.expected), 'utf8'));

    expect(parseClientLogFixture(input)).toEqual(expected);
  });

  it('prices fixture items against frozen rate snapshots', () => {
    const fixture = manifest.fixtures.pricing[0];
    const items = JSON.parse(fs.readFileSync(path.join(fixtureRoot, fixture.items), 'utf8'));
    const rates = JSON.parse(fs.readFileSync(path.join(fixtureRoot, fixture.rates), 'utf8'));
    const expected = JSON.parse(fs.readFileSync(path.join(fixtureRoot, fixture.expected), 'utf8'));

    expect(priceFixtureItems(items, rates)).toEqual(expected);
  });

  it('values stash fixture payloads against frozen rate snapshots', () => {
    const fixture = manifest.fixtures.stashValuation[0];
    const items = JSON.parse(fs.readFileSync(path.join(fixtureRoot, fixture.input), 'utf8'));
    const rates = JSON.parse(fs.readFileSync(path.join(fixtureRoot, fixture.rates), 'utf8'));
    const expected = JSON.parse(fs.readFileSync(path.join(fixtureRoot, fixture.expected), 'utf8'));

    expect(valueFixtureStash(items, rates)).toEqual(expected);
  });
});
