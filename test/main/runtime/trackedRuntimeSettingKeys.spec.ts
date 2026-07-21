import { trackedRuntimeSettingKeys } from '../../../src/main/runtime/trackedRuntimeSettingKeys';

describe('trackedRuntimeSettingKeys', () => {
  it('forwards autoscroll changes from the runtime sidecar', () => {
    expect(trackedRuntimeSettingKeys).toContain('enableAutoscroll');
  });
});
