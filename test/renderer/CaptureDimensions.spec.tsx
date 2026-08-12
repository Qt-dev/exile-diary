import { getFullCaptureDimensions } from '../../src/renderer/utils/captureDimensions';

describe('full capture dimensions', () => {
  it('uses the full scroll extent when content exceeds the visible box', () => {
    expect(
      getFullCaptureDimensions({
        clientWidth: 800,
        clientHeight: 600,
        scrollWidth: 820,
        scrollHeight: 1_750,
      })
    ).toEqual({ width: 820, height: 1_750 });
  });

  it('does not shrink below the visible box', () => {
    expect(
      getFullCaptureDimensions({
        clientWidth: 800,
        clientHeight: 600,
        scrollWidth: 0,
        scrollHeight: 0,
      })
    ).toEqual({ width: 800, height: 600 });
  });
});
