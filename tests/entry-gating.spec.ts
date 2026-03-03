import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import {
  ADMIN_LOGIN_ROUTE,
  CREATE_MASTER_ADMIN_ROUTE,
  determineEntryRoute,
  shouldExposeMasterAdminSetup,
} from "../src/domain/services/entry-gate";
import {
  DEFAULT_GATE_ERROR_MESSAGE,
  DEFAULT_GATE_CHECK_TIMEOUT_MS,
  GATE_TIMEOUT_ERROR_MESSAGE,
  invalidateEntryGateSnapshot,
  resolveAdminLoginVisibility,
  resolveCreateMasterAdminVisibility,
  resolveEntryRouteFromAdminCheck,
  updateEntryGateSnapshotAfterAdminChange,
} from "../src/domain/services/entry-gate-runtime";
import {
  clearEntryGateSnapshot,
  DEFAULT_ENTRY_GATE_SNAPSHOT_MAX_AGE_MS,
  readEntryGateSnapshot,
  storeEntryGateSnapshot,
} from "../src/domain/services/entry-gate-snapshot";
import {
  getAdminLoginScreenViewState,
  getCreateMasterAdminScreenViewState,
  getEntryGateScreenViewState,
} from "../src/domain/services/entry-gate-view-state";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function collectRouteFilePaths(directory: string): string[] {
  const children = readdirSync(directory);
  const routes: string[] = [];

  for (const child of children) {
    const absolutePath = join(directory, child);
    const stats = statSync(absolutePath);
    if (stats.isDirectory()) {
      routes.push(...collectRouteFilePaths(absolutePath));
      continue;
    }

    if (!child.endsWith(".tsx")) {
      continue;
    }
    if (child.startsWith("_")) {
      continue;
    }

    routes.push(absolutePath);
  }

  return routes;
}

function toExpoPath(appDirectory: string, filePath: string): string {
  const relativePath = relative(appDirectory, filePath);
  const withoutExtension = relativePath.replace(/\.tsx$/, "");
  const segments = withoutExtension
    .split(sep)
    .filter(Boolean)
    .filter((segment) => !/^\(.+\)$/.test(segment))
    .filter((segment) => segment !== "index");

  if (segments.length === 0) {
    return "/";
  }

  return `/${segments.join("/")}`;
}

async function runEntryGateTests() {
  const originalWarn = console.warn;
  console.warn = () => {};

  try {
    clearEntryGateSnapshot();
    assert(
      DEFAULT_ENTRY_GATE_SNAPSHOT_MAX_AGE_MS >= DEFAULT_GATE_CHECK_TIMEOUT_MS,
      "Snapshot max age should cover the default gate timeout to avoid startup re-checks on slower devices.",
    );

  const firstRunRoute = determineEntryRoute(false);
  assert(
    firstRunRoute === CREATE_MASTER_ADMIN_ROUTE,
    "Expected no-admin path to route to Create Master Admin.",
  );

  const returningAdminRoute = determineEntryRoute(true);
  assert(
    returningAdminRoute === ADMIN_LOGIN_ROUTE,
    "Expected existing-admin path to route to Admin Login.",
  );

  assert(
    shouldExposeMasterAdminSetup(false),
    "Master admin setup should be visible when no admin exists.",
  );
  assert(
    !shouldExposeMasterAdminSetup(true),
    "Master admin setup should not be visible once an admin exists.",
  );

  const gateDestinations = [firstRunRoute, returningAdminRoute] as string[];
  assert(
    !gateDestinations.includes("/explore"),
    "Starter explore route should never be a gate destination.",
  );

  const routeNoAdmin = await resolveEntryRouteFromAdminCheck(async () => false);
  assert(
    routeNoAdmin.kind === "success" &&
      routeNoAdmin.value === CREATE_MASTER_ADMIN_ROUTE,
    "Entry screen should resolve to Create Master Admin when no admin exists.",
  );

  const routeWithAdmin = await resolveEntryRouteFromAdminCheck(async () => true);
  assert(
    routeWithAdmin.kind === "success" && routeWithAdmin.value === ADMIN_LOGIN_ROUTE,
    "Entry screen should resolve to Admin Login when an admin exists.",
  );

  clearEntryGateSnapshot();
  const setupGuardNoAdmin = await resolveCreateMasterAdminVisibility(
    async () => false,
    { useRecentSnapshot: false },
  );
  assert(
    setupGuardNoAdmin.kind === "success" && setupGuardNoAdmin.value,
    "Create Master Admin screen should remain visible when no admin exists.",
  );

  const setupGuardWithAdmin = await resolveCreateMasterAdminVisibility(
    async () => true,
    { useRecentSnapshot: false },
  );
  assert(
    setupGuardWithAdmin.kind === "success" && !setupGuardWithAdmin.value,
    "Create Master Admin screen should redirect when an admin exists.",
  );

  const loginGuardNoAdmin = await resolveAdminLoginVisibility(
    async () => false,
    { useRecentSnapshot: false },
  );
  assert(
    loginGuardNoAdmin.kind === "success" && !loginGuardNoAdmin.value,
    "Admin Login screen should redirect when no admin exists.",
  );

  const loginGuardWithAdmin = await resolveAdminLoginVisibility(
    async () => true,
    { useRecentSnapshot: false },
  );
  assert(
    loginGuardWithAdmin.kind === "success" && loginGuardWithAdmin.value,
    "Admin Login screen should remain visible when an admin exists.",
  );

    clearEntryGateSnapshot();
    let adminCheckCallCount = 0;
    const readHasAdminForBoot = async () => {
      adminCheckCallCount += 1;
      return false;
    };

    const bootResult = await resolveEntryRouteFromAdminCheck(readHasAdminForBoot);
    assert(
      bootResult.kind === "success" &&
        bootResult.value === CREATE_MASTER_ADMIN_ROUTE,
      "Boot flow should resolve create-master-admin when no admin exists.",
    );

    const createGuardAfterBoot = await resolveCreateMasterAdminVisibility(
      async () => {
        adminCheckCallCount += 1;
        return false;
      },
    );
    assert(
      createGuardAfterBoot.kind === "success" && createGuardAfterBoot.value,
      "Create guard should use cached boot result when available.",
    );
    assert(
      readEntryGateSnapshot() === null,
      "Destination guard should consume and clear startup snapshot state.",
    );
    assert(
      adminCheckCallCount === 1,
      "Admin existence should be read once during startup route + destination shell resolution.",
    );

    const loginGuardAfterSnapshotConsumption = await resolveAdminLoginVisibility(
      async () => {
        adminCheckCallCount += 1;
        return false;
      },
    );
    assert(
      loginGuardAfterSnapshotConsumption.kind === "success" &&
        !loginGuardAfterSnapshotConsumption.value,
      "Destination guard should refresh admin existence once startup snapshot has been consumed.",
    );
    assert(
      readEntryGateSnapshot() === null,
      "Destination guard checks should not retain snapshot state after resolving.",
    );
    assert(
      adminCheckCallCount === 2,
      "Startup snapshot should only dedupe the first destination guard check.",
    );

    clearEntryGateSnapshot();
    storeEntryGateSnapshot(false);
    updateEntryGateSnapshotAfterAdminChange(true);
    assert(
      readEntryGateSnapshot() === true,
      "Admin-change updates should replace stale snapshot values explicitly.",
    );
    invalidateEntryGateSnapshot();
    assert(
      readEntryGateSnapshot() === null,
      "Explicit snapshot invalidation should clear cached startup gate values.",
    );

    const originalDateNow = Date.now;
    try {
      storeEntryGateSnapshot(false, 1_000);
      Date.now = () => 1_000 + DEFAULT_ENTRY_GATE_SNAPSHOT_MAX_AGE_MS - 1;
      assert(
        readEntryGateSnapshot() === false,
        "Entry gate snapshot should remain reusable near the max-age boundary.",
      );
      Date.now = () => 1_000 + DEFAULT_ENTRY_GATE_SNAPSHOT_MAX_AGE_MS + 1;
      assert(
        readEntryGateSnapshot() === null,
        "Entry gate snapshot should expire once max-age is exceeded.",
      );
    } finally {
      Date.now = originalDateNow;
      clearEntryGateSnapshot();
    }

    const simulatedDbFailure = new Error("DB read failed");
    const errorResult = await resolveEntryRouteFromAdminCheck(async () => {
      throw simulatedDbFailure;
    });
    assert(
      errorResult.kind === "error",
      "Entry screen should return an error state when DB lookup fails.",
    );
    if (errorResult.kind === "error") {
      assert(
        errorResult.message === DEFAULT_GATE_ERROR_MESSAGE,
        "Entry screen should show the default gate error message.",
      );
    }

    const timeoutStartedAt = Date.now();
    const timeoutResult = await resolveEntryRouteFromAdminCheck(
      () => new Promise<boolean>(() => {}),
      { timeoutMs: 20 },
    );
    const timeoutElapsed = Date.now() - timeoutStartedAt;

    assert(
      timeoutResult.kind === "error",
      "A hanging admin check should resolve to a retryable error state.",
    );
    if (timeoutResult.kind === "error") {
      assert(
        timeoutResult.message === GATE_TIMEOUT_ERROR_MESSAGE,
        "Timed-out admin checks should return the timeout-specific gate message.",
      );
    }
    assert(
      timeoutElapsed >= 10,
      `Timeout should wait before failing (elapsed ${timeoutElapsed}ms).`,
    );
    assert(
      timeoutElapsed < DEFAULT_GATE_CHECK_TIMEOUT_MS,
      "Timeout override should be honored by gate runtime.",
    );

    const loadingState = getEntryGateScreenViewState(null, null);
    assert(
      loadingState.kind === "loading",
      "Entry screen should be loading before route is resolved.",
    );
    const errorState = getEntryGateScreenViewState(null, "failure");
    assert(
      errorState.kind === "error" && errorState.message === "failure",
      "Entry screen should render error state when gate check fails.",
    );
    const redirectToCreateState = getEntryGateScreenViewState(
      CREATE_MASTER_ADMIN_ROUTE,
      null,
    );
    assert(
      redirectToCreateState.kind === "redirect" &&
        redirectToCreateState.href === CREATE_MASTER_ADMIN_ROUTE,
      "Entry screen should redirect to create-master-admin route when no admin exists.",
    );
    const redirectToLoginState = getEntryGateScreenViewState(ADMIN_LOGIN_ROUTE, null);
    assert(
      redirectToLoginState.kind === "redirect" &&
        redirectToLoginState.href === ADMIN_LOGIN_ROUTE,
      "Entry screen should redirect to admin-login route when an admin exists.",
    );

    const createScreenLoading = getCreateMasterAdminScreenViewState(null, null);
    assert(
      createScreenLoading.kind === "loading",
      "Create Master Admin screen should render loading while guard is unresolved.",
    );
    const createScreenError = getCreateMasterAdminScreenViewState(null, "failure");
    assert(
      createScreenError.kind === "error" && createScreenError.message === "failure",
      "Create Master Admin screen should render gate errors.",
    );
    const createScreenRedirect = getCreateMasterAdminScreenViewState(false, null);
    assert(
      createScreenRedirect.kind === "redirect" &&
        createScreenRedirect.href === ADMIN_LOGIN_ROUTE,
      "Create Master Admin screen should redirect to login when admin already exists.",
    );
    const createScreenContent = getCreateMasterAdminScreenViewState(true, null);
    assert(
      createScreenContent.kind === "content",
      "Create Master Admin screen should render content when no admin exists.",
    );

    const loginScreenLoading = getAdminLoginScreenViewState(null, null);
    assert(
      loginScreenLoading.kind === "loading",
      "Admin Login screen should render loading while guard is unresolved.",
    );
    const loginScreenError = getAdminLoginScreenViewState(null, "failure");
    assert(
      loginScreenError.kind === "error" && loginScreenError.message === "failure",
      "Admin Login screen should render gate errors.",
    );
    const loginScreenRedirect = getAdminLoginScreenViewState(false, null);
    assert(
      loginScreenRedirect.kind === "redirect" &&
        loginScreenRedirect.href === CREATE_MASTER_ADMIN_ROUTE,
      "Admin Login screen should redirect to create-master-admin when no admin exists.",
    );
    const loginScreenContent = getAdminLoginScreenViewState(true, null);
    assert(
      loginScreenContent.kind === "content",
      "Admin Login screen should render content when admin exists.",
    );

    const appDirectory = join(process.cwd(), "src", "app");
    const appRoutes = collectRouteFilePaths(appDirectory).map((filePath) =>
      toExpoPath(appDirectory, filePath),
    );
    assert(
      !appRoutes.includes("/explore"),
      "Starter explore route should not exist in Expo Router route files.",
    );
    assert(
      appRoutes.includes("/") &&
        appRoutes.includes("/create-master-admin") &&
        appRoutes.includes("/login"),
      "Expected logged-out entry routes should be present in Expo Router route files.",
    );

    // Dev HMR can keep module state alive, but a real app restart must begin with
    // a new process and no persisted in-memory admin session.
    const processWithSession = spawnSync(
      process.execPath,
      [
        "-e",
        "const session=require('./.tmp-tests/src/domain/services/admin-session.js');session.setAdminSession({id:1,username:'admin'});if(!session.isAdminAuthenticated())process.exit(1);",
      ],
      {
        cwd: process.cwd(),
        encoding: "utf8",
      },
    );
    assert(
      processWithSession.status === 0,
      `Expected first fresh process to create an in-memory authenticated session. stderr: ${processWithSession.stderr}`,
    );

    const restartedProcess = spawnSync(
      process.execPath,
      [
        "-e",
        "const session=require('./.tmp-tests/src/domain/services/admin-session.js');if(session.isAdminAuthenticated())process.exit(1);if(session.getAdminSession()!==null)process.exit(1);",
      ],
      {
        cwd: process.cwd(),
        encoding: "utf8",
      },
    );
    assert(
      restartedProcess.status === 0,
      `Expected app-process restart behavior to begin logged out with no persisted admin session. stderr: ${restartedProcess.stderr}`,
    );
  } finally {
    console.warn = originalWarn;
  }
}

runEntryGateTests()
  .then(() => {
    console.log("entry-gating.spec.ts passed");
  })
  .catch((error: unknown) => {
    console.error("entry-gating.spec.ts failed");
    console.error(error);
    throw error;
  });
