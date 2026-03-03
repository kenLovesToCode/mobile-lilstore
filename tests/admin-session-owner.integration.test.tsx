function loadAdminSessionModule() {
  return require("../src/domain/services/admin-session");
}

describe("admin-session active owner state", () => {
  beforeEach(() => {
    jest.resetModules();
    const session = loadAdminSessionModule();
    session.clearAdminSession();
  });

  it("starts with no active owner and sets owner atomically", () => {
    const session = loadAdminSessionModule();
    const snapshots: Array<{
      ownerName: string | null;
      authenticated: boolean;
    }> = [];

    const unsubscribe = session.subscribeToAdminSession(() => {
      snapshots.push({
        ownerName: session.getActiveOwner()?.name ?? null,
        authenticated: session.isAdminAuthenticated(),
      });
    });

    session.setAdminSession({ id: 1, username: "admin" });
    expect(session.getActiveOwner()).toBeNull();

    session.setActiveOwner({ id: 9, name: "Downtown Store" });
    expect(session.getActiveOwner()).toEqual({ id: 9, name: "Downtown Store" });

    expect(snapshots).toEqual([
      { ownerName: null, authenticated: true },
      { ownerName: "Downtown Store", authenticated: true },
    ]);

    unsubscribe();
  });

  it("clears active owner on logout", () => {
    const session = loadAdminSessionModule();

    session.setAdminSession({ id: 1, username: "admin" });
    session.setActiveOwner({ id: 2, name: "North Store" });
    expect(session.getActiveOwner()).toEqual({ id: 2, name: "North Store" });

    session.clearAdminSession();

    expect(session.getActiveOwner()).toBeNull();
    expect(session.isAdminAuthenticated()).toBe(false);
  });
});
