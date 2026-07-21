describe('AuthSessionReadiness', () => {
  async function loadService() {
    jest.resetModules();
    return (await import('../../../src/main/auth/AuthSessionReadiness')).authSessionReadiness;
  }

  it('keeps account callers pending until account access is released', async () => {
    const authSessionReadiness = await loadService();
    authSessionReadiness.setAccountReady(false);
    authSessionReadiness.setProfileReady(false);

    const waitForAccountAccess = authSessionReadiness.waitForAccountAccess();
    let wasReleased = false;
    void waitForAccountAccess.then(() => {
      wasReleased = true;
    });

    await Promise.resolve();
    expect(wasReleased).toBe(false);

    authSessionReadiness.setAccountReady(true);
    await waitForAccountAccess;
    expect(wasReleased).toBe(true);
  });

  it('keeps profile callers pending until both account and profile access are ready', async () => {
    const authSessionReadiness = await loadService();
    authSessionReadiness.setAccountReady(false);
    authSessionReadiness.setProfileReady(false);

    const waitForProfileAccess = authSessionReadiness.waitForProfileAccess();
    let wasReleased = false;
    void waitForProfileAccess.then(() => {
      wasReleased = true;
    });

    authSessionReadiness.setAccountReady(true);
    await Promise.resolve();
    expect(wasReleased).toBe(false);

    authSessionReadiness.setProfileReady(true);
    await waitForProfileAccess;
    expect(wasReleased).toBe(true);
  });

  it('re-blocks future callers after account access is revoked', async () => {
    const authSessionReadiness = await loadService();
    authSessionReadiness.setProfileReady(true);
    authSessionReadiness.setAccountReady(true);
    await authSessionReadiness.waitForProfileAccess();

    authSessionReadiness.setAccountReady(false);
    const waitForProfileAccess = authSessionReadiness.waitForProfileAccess();
    let wasReleased = false;
    void waitForProfileAccess.then(() => {
      wasReleased = true;
    });

    await Promise.resolve();
    expect(wasReleased).toBe(false);

    authSessionReadiness.setAccountReady(true);
    await waitForProfileAccess;
    expect(wasReleased).toBe(true);
  });
});
