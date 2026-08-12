type CaptureDimensions = Pick<HTMLElement, 'clientHeight' | 'clientWidth' | 'scrollHeight' | 'scrollWidth'>;

export const getFullCaptureDimensions = (target: CaptureDimensions) => ({
  width: Math.max(target.scrollWidth, target.clientWidth),
  height: Math.max(target.scrollHeight, target.clientHeight),
});
