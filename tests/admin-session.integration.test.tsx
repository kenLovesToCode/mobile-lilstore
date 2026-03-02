function loadAdminSessionModule() {
  return require("../src/domain/services/admin-session");
}

describe("admin-session non-persistence", () => {
  beforeEach(() => {
    jest.resetModules();
    const session = loadAdminSessionModule();
    session.clearAdminSession();
  });

  it("starts logged out in a fresh runtime", () => {
    const session = loadAdminSessionModule();
    session.setAdminSession({ id: 1, username: "admin" });
    expect(session.isAdminAuthenticated()).toBe(true);

    jest.isolateModules(() => {
      const freshSession = loadAdminSessionModule();
      expect(freshSession.isAdminAuthenticated()).toBe(false);
      expect(freshSession.getAdminSession()).toBeNull();
    });
  });

  it("does not allow caller mutation to alter stored session state", () => {
    const session = loadAdminSessionModule();
    const input = { id: 1, username: "admin" };

    session.setAdminSession(input);
    const snapshot = session.getAdminSession();
    expect(snapshot).toEqual({ id: 1, username: "admin" });

    input.username = "changed-outside";
    expect(session.getAdminSession()).toEqual({ id: 1, username: "admin" });

    if (snapshot) {
      (snapshot as { username: string }).username = "mutated";
    }
    expect(session.getAdminSession()).toEqual({ id: 1, username: "admin" });
  });

  it("continues notifying listeners when one subscriber throws", () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const session = loadAdminSessionModule();
    const notified: string[] = [];

    const unsubscribeFirst = session.subscribeToAdminSession(() => {
      notified.push("first");
      throw new Error("listener failed");
    });
    const unsubscribeSecond = session.subscribeToAdminSession(() => {
      notified.push("second");
    });

    expect(() =>
      session.setAdminSession({ id: 1, username: "admin" }),
    ).not.toThrow();
    expect(notified).toEqual(["first", "second"]);
    expect(warnSpy).toHaveBeenCalledWith(
      "[admin-session] listener callback failed",
      { reason: "Error" },
    );

    notified.length = 0;
    expect(() => session.clearAdminSession()).not.toThrow();
    expect(notified).toEqual(["first", "second"]);

    unsubscribeFirst();
    unsubscribeSecond();
    warnSpy.mockRestore();
  });

  it("clears active session state and notifies subscribers on logout", () => {
    const session = loadAdminSessionModule();
    const snapshots: Array<{ authenticated: boolean; username: string | null }> =
      [];

    const unsubscribe = session.subscribeToAdminSession(() => {
      snapshots.push({
        authenticated: session.isAdminAuthenticated(),
        username: session.getAdminSession()?.username ?? null,
      });
    });

    session.setAdminSession({ id: 1, username: "admin" });
    session.clearAdminSession();

    expect(session.isAdminAuthenticated()).toBe(false);
    expect(session.getAdminSession()).toBeNull();
    expect(snapshots).toEqual([
      { authenticated: true, username: "admin" },
      { authenticated: false, username: null },
    ]);

    unsubscribe();
  });
});
