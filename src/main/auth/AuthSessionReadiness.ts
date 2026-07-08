type AuthSessionReadinessSnapshot = {
  accountReady: boolean;
  profileConfigured: boolean;
  profileReady: boolean;
};

type AuthSessionReadinessListener = (snapshot: AuthSessionReadinessSnapshot) => void;

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((promiseResolve) => {
    resolve = promiseResolve;
  });

  return { promise, resolve };
}

class AuthSessionReadiness {
  private accountReady = false;
  private profileConfigured = false;
  private accountWaiters: Array<ReturnType<typeof createDeferred>> = [];
  private profileWaiters: Array<ReturnType<typeof createDeferred>> = [];
  private listeners = new Set<AuthSessionReadinessListener>();

  private getSnapshot(): AuthSessionReadinessSnapshot {
    return {
      accountReady: this.accountReady,
      profileConfigured: this.profileConfigured,
      profileReady: this.accountReady && this.profileConfigured,
    };
  }

  private notify() {
    const snapshot = this.getSnapshot();

    if (snapshot.accountReady) {
      this.accountWaiters.splice(0).forEach((waiter) => waiter.resolve());
    }

    if (snapshot.profileReady) {
      this.profileWaiters.splice(0).forEach((waiter) => waiter.resolve());
    }

    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  setAccountReady(accountReady: boolean) {
    this.accountReady = accountReady;
    this.notify();
  }

  setProfileReady(profileConfigured: boolean) {
    this.profileConfigured = profileConfigured;
    this.notify();
  }

  waitForAccountAccess() {
    if (this.accountReady) {
      return Promise.resolve();
    }

    const deferred = createDeferred();
    this.accountWaiters.push(deferred);
    return deferred.promise;
  }

  waitForProfileAccess() {
    if (this.accountReady && this.profileConfigured) {
      return Promise.resolve();
    }

    const deferred = createDeferred();
    this.profileWaiters.push(deferred);
    return deferred.promise;
  }

  subscribe(listener: AuthSessionReadinessListener) {
    this.listeners.add(listener);
    listener(this.getSnapshot());

    return () => {
      this.listeners.delete(listener);
    };
  }

  getState() {
    return this.getSnapshot();
  }
}

export const authSessionReadiness = new AuthSessionReadiness();
