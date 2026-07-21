const fs = jest.requireActual('node:fs') as typeof import('node:fs');
const path = jest.requireActual('node:path') as typeof import('node:path');

const rootDir = path.resolve(__dirname, '../../..');

describe('Linux build workflow contract', () => {
  it.each(['build-linux.yml', 'release.yml'])(
    'installs the native headers required by electron-overlay-window in %s',
    (workflowName) => {
      const workflow = fs.readFileSync(
        path.join(rootDir, '.github', 'workflows', workflowName),
        'utf8'
      );

      expect(workflow).toContain('libxcb1-dev');
      expect(workflow.lastIndexOf('libxcb1-dev')).toBeLessThan(workflow.lastIndexOf('npm ci'));
    }
  );
});
