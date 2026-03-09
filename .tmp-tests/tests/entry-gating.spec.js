"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_child_process_1 = require("node:child_process");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const entry_gate_1 = require("../src/domain/services/entry-gate");
const entry_gate_runtime_1 = require("../src/domain/services/entry-gate-runtime");
const entry_gate_snapshot_1 = require("../src/domain/services/entry-gate-snapshot");
const entry_gate_view_state_1 = require("../src/domain/services/entry-gate-view-state");
function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}
function collectRouteFilePaths(directory) {
    const children = (0, node_fs_1.readdirSync)(directory);
    const routes = [];
    for (const child of children) {
        const absolutePath = (0, node_path_1.join)(directory, child);
        const stats = (0, node_fs_1.statSync)(absolutePath);
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
function toExpoPath(appDirectory, filePath) {
    const relativePath = (0, node_path_1.relative)(appDirectory, filePath);
    const withoutExtension = relativePath.replace(/\.tsx$/, "");
    const segments = withoutExtension
        .split(node_path_1.sep)
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
    console.warn = () => { };
    try {
        (0, entry_gate_snapshot_1.clearEntryGateSnapshot)();
        assert(entry_gate_snapshot_1.DEFAULT_ENTRY_GATE_SNAPSHOT_MAX_AGE_MS >= entry_gate_runtime_1.DEFAULT_GATE_CHECK_TIMEOUT_MS, "Snapshot max age should cover the default gate timeout to avoid startup re-checks on slower devices.");
        const firstRunRoute = (0, entry_gate_1.determineEntryRoute)(false);
        assert(firstRunRoute === entry_gate_1.CREATE_MASTER_ADMIN_ROUTE, "Expected no-admin path to route to Create Master Admin.");
        const returningAdminRoute = (0, entry_gate_1.determineEntryRoute)(true);
        assert(returningAdminRoute === entry_gate_1.ADMIN_LOGIN_ROUTE, "Expected existing-admin path to route to Admin Login.");
        assert((0, entry_gate_1.shouldExposeMasterAdminSetup)(false), "Master admin setup should be visible when no admin exists.");
        assert(!(0, entry_gate_1.shouldExposeMasterAdminSetup)(true), "Master admin setup should not be visible once an admin exists.");
        const gateDestinations = [firstRunRoute, returningAdminRoute];
        assert(!gateDestinations.includes("/explore"), "Starter explore route should never be a gate destination.");
        const routeNoAdmin = await (0, entry_gate_runtime_1.resolveEntryRouteFromAdminCheck)(async () => false);
        assert(routeNoAdmin.kind === "success" &&
            routeNoAdmin.value === entry_gate_1.CREATE_MASTER_ADMIN_ROUTE, "Entry screen should resolve to Create Master Admin when no admin exists.");
        const routeWithAdmin = await (0, entry_gate_runtime_1.resolveEntryRouteFromAdminCheck)(async () => true);
        assert(routeWithAdmin.kind === "success" && routeWithAdmin.value === entry_gate_1.ADMIN_LOGIN_ROUTE, "Entry screen should resolve to Admin Login when an admin exists.");
        (0, entry_gate_snapshot_1.clearEntryGateSnapshot)();
        const setupGuardNoAdmin = await (0, entry_gate_runtime_1.resolveCreateMasterAdminVisibility)(async () => false, { useRecentSnapshot: false });
        assert(setupGuardNoAdmin.kind === "success" && setupGuardNoAdmin.value, "Create Master Admin screen should remain visible when no admin exists.");
        const setupGuardWithAdmin = await (0, entry_gate_runtime_1.resolveCreateMasterAdminVisibility)(async () => true, { useRecentSnapshot: false });
        assert(setupGuardWithAdmin.kind === "success" && !setupGuardWithAdmin.value, "Create Master Admin screen should redirect when an admin exists.");
        const loginGuardNoAdmin = await (0, entry_gate_runtime_1.resolveAdminLoginVisibility)(async () => false, { useRecentSnapshot: false });
        assert(loginGuardNoAdmin.kind === "success" && !loginGuardNoAdmin.value, "Admin Login screen should redirect when no admin exists.");
        const loginGuardWithAdmin = await (0, entry_gate_runtime_1.resolveAdminLoginVisibility)(async () => true, { useRecentSnapshot: false });
        assert(loginGuardWithAdmin.kind === "success" && loginGuardWithAdmin.value, "Admin Login screen should remain visible when an admin exists.");
        (0, entry_gate_snapshot_1.clearEntryGateSnapshot)();
        let adminCheckCallCount = 0;
        const readHasAdminForBoot = async () => {
            adminCheckCallCount += 1;
            return false;
        };
        const bootResult = await (0, entry_gate_runtime_1.resolveEntryRouteFromAdminCheck)(readHasAdminForBoot);
        assert(bootResult.kind === "success" &&
            bootResult.value === entry_gate_1.CREATE_MASTER_ADMIN_ROUTE, "Boot flow should resolve create-master-admin when no admin exists.");
        const createGuardAfterBoot = await (0, entry_gate_runtime_1.resolveCreateMasterAdminVisibility)(async () => {
            adminCheckCallCount += 1;
            return false;
        });
        assert(createGuardAfterBoot.kind === "success" && createGuardAfterBoot.value, "Create guard should use cached boot result when available.");
        assert((0, entry_gate_snapshot_1.readEntryGateSnapshot)() === null, "Destination guard should consume and clear startup snapshot state.");
        assert(adminCheckCallCount === 1, "Admin existence should be read once during startup route + destination shell resolution.");
        const loginGuardAfterSnapshotConsumption = await (0, entry_gate_runtime_1.resolveAdminLoginVisibility)(async () => {
            adminCheckCallCount += 1;
            return false;
        });
        assert(loginGuardAfterSnapshotConsumption.kind === "success" &&
            !loginGuardAfterSnapshotConsumption.value, "Destination guard should refresh admin existence once startup snapshot has been consumed.");
        assert((0, entry_gate_snapshot_1.readEntryGateSnapshot)() === null, "Destination guard checks should not retain snapshot state after resolving.");
        assert(adminCheckCallCount === 2, "Startup snapshot should only dedupe the first destination guard check.");
        (0, entry_gate_snapshot_1.clearEntryGateSnapshot)();
        (0, entry_gate_snapshot_1.storeEntryGateSnapshot)(false);
        (0, entry_gate_runtime_1.updateEntryGateSnapshotAfterAdminChange)(true);
        assert((0, entry_gate_snapshot_1.readEntryGateSnapshot)() === true, "Admin-change updates should replace stale snapshot values explicitly.");
        (0, entry_gate_runtime_1.invalidateEntryGateSnapshot)();
        assert((0, entry_gate_snapshot_1.readEntryGateSnapshot)() === null, "Explicit snapshot invalidation should clear cached startup gate values.");
        const originalDateNow = Date.now;
        try {
            (0, entry_gate_snapshot_1.storeEntryGateSnapshot)(false, 1_000);
            Date.now = () => 1_000 + entry_gate_snapshot_1.DEFAULT_ENTRY_GATE_SNAPSHOT_MAX_AGE_MS - 1;
            assert((0, entry_gate_snapshot_1.readEntryGateSnapshot)() === false, "Entry gate snapshot should remain reusable near the max-age boundary.");
            Date.now = () => 1_000 + entry_gate_snapshot_1.DEFAULT_ENTRY_GATE_SNAPSHOT_MAX_AGE_MS + 1;
            assert((0, entry_gate_snapshot_1.readEntryGateSnapshot)() === null, "Entry gate snapshot should expire once max-age is exceeded.");
        }
        finally {
            Date.now = originalDateNow;
            (0, entry_gate_snapshot_1.clearEntryGateSnapshot)();
        }
        const simulatedDbFailure = new Error("DB read failed");
        const errorResult = await (0, entry_gate_runtime_1.resolveEntryRouteFromAdminCheck)(async () => {
            throw simulatedDbFailure;
        });
        assert(errorResult.kind === "error", "Entry screen should return an error state when DB lookup fails.");
        if (errorResult.kind === "error") {
            assert(errorResult.message === entry_gate_runtime_1.DEFAULT_GATE_ERROR_MESSAGE, "Entry screen should show the default gate error message.");
        }
        const timeoutStartedAt = Date.now();
        const timeoutResult = await (0, entry_gate_runtime_1.resolveEntryRouteFromAdminCheck)(() => new Promise(() => { }), { timeoutMs: 20 });
        const timeoutElapsed = Date.now() - timeoutStartedAt;
        assert(timeoutResult.kind === "error", "A hanging admin check should resolve to a retryable error state.");
        if (timeoutResult.kind === "error") {
            assert(timeoutResult.message === entry_gate_runtime_1.GATE_TIMEOUT_ERROR_MESSAGE, "Timed-out admin checks should return the timeout-specific gate message.");
        }
        assert(timeoutElapsed >= 10, `Timeout should wait before failing (elapsed ${timeoutElapsed}ms).`);
        assert(timeoutElapsed < entry_gate_runtime_1.DEFAULT_GATE_CHECK_TIMEOUT_MS, "Timeout override should be honored by gate runtime.");
        const loadingState = (0, entry_gate_view_state_1.getEntryGateScreenViewState)(null, null);
        assert(loadingState.kind === "loading", "Entry screen should be loading before route is resolved.");
        const errorState = (0, entry_gate_view_state_1.getEntryGateScreenViewState)(null, "failure");
        assert(errorState.kind === "error" && errorState.message === "failure", "Entry screen should render error state when gate check fails.");
        const redirectToCreateState = (0, entry_gate_view_state_1.getEntryGateScreenViewState)(entry_gate_1.CREATE_MASTER_ADMIN_ROUTE, null);
        assert(redirectToCreateState.kind === "redirect" &&
            redirectToCreateState.href === entry_gate_1.CREATE_MASTER_ADMIN_ROUTE, "Entry screen should redirect to create-master-admin route when no admin exists.");
        const redirectToLoginState = (0, entry_gate_view_state_1.getEntryGateScreenViewState)(entry_gate_1.ADMIN_LOGIN_ROUTE, null);
        assert(redirectToLoginState.kind === "redirect" &&
            redirectToLoginState.href === entry_gate_1.ADMIN_LOGIN_ROUTE, "Entry screen should redirect to admin-login route when an admin exists.");
        const createScreenLoading = (0, entry_gate_view_state_1.getCreateMasterAdminScreenViewState)(null, null);
        assert(createScreenLoading.kind === "loading", "Create Master Admin screen should render loading while guard is unresolved.");
        const createScreenError = (0, entry_gate_view_state_1.getCreateMasterAdminScreenViewState)(null, "failure");
        assert(createScreenError.kind === "error" && createScreenError.message === "failure", "Create Master Admin screen should render gate errors.");
        const createScreenRedirect = (0, entry_gate_view_state_1.getCreateMasterAdminScreenViewState)(false, null);
        assert(createScreenRedirect.kind === "redirect" &&
            createScreenRedirect.href === entry_gate_1.ADMIN_LOGIN_ROUTE, "Create Master Admin screen should redirect to login when admin already exists.");
        const createScreenContent = (0, entry_gate_view_state_1.getCreateMasterAdminScreenViewState)(true, null);
        assert(createScreenContent.kind === "content", "Create Master Admin screen should render content when no admin exists.");
        const loginScreenLoading = (0, entry_gate_view_state_1.getAdminLoginScreenViewState)(null, null);
        assert(loginScreenLoading.kind === "loading", "Admin Login screen should render loading while guard is unresolved.");
        const loginScreenError = (0, entry_gate_view_state_1.getAdminLoginScreenViewState)(null, "failure");
        assert(loginScreenError.kind === "error" && loginScreenError.message === "failure", "Admin Login screen should render gate errors.");
        const loginScreenRedirect = (0, entry_gate_view_state_1.getAdminLoginScreenViewState)(false, null);
        assert(loginScreenRedirect.kind === "redirect" &&
            loginScreenRedirect.href === entry_gate_1.CREATE_MASTER_ADMIN_ROUTE, "Admin Login screen should redirect to create-master-admin when no admin exists.");
        const loginScreenContent = (0, entry_gate_view_state_1.getAdminLoginScreenViewState)(true, null);
        assert(loginScreenContent.kind === "content", "Admin Login screen should render content when admin exists.");
        const appDirectory = (0, node_path_1.join)(process.cwd(), "src", "app");
        const appRoutes = collectRouteFilePaths(appDirectory).map((filePath) => toExpoPath(appDirectory, filePath));
        assert(!appRoutes.includes("/explore"), "Starter explore route should not exist in Expo Router route files.");
        assert(appRoutes.includes("/") &&
            appRoutes.includes("/create-master-admin") &&
            appRoutes.includes("/login"), "Expected logged-out entry routes should be present in Expo Router route files.");
        // Dev HMR can keep module state alive, but a real app restart must begin with
        // a new process and no persisted in-memory admin session.
        const processWithSession = (0, node_child_process_1.spawnSync)(process.execPath, [
            "-e",
            "const session=require('./.tmp-tests/src/domain/services/admin-session.js');session.setAdminSession({id:1,username:'admin'});if(!session.isAdminAuthenticated())process.exit(1);",
        ], {
            cwd: process.cwd(),
            encoding: "utf8",
        });
        assert(processWithSession.status === 0, `Expected first fresh process to create an in-memory authenticated session. stderr: ${processWithSession.stderr}`);
        const restartedProcess = (0, node_child_process_1.spawnSync)(process.execPath, [
            "-e",
            "const session=require('./.tmp-tests/src/domain/services/admin-session.js');if(session.isAdminAuthenticated())process.exit(1);if(session.getAdminSession()!==null)process.exit(1);",
        ], {
            cwd: process.cwd(),
            encoding: "utf8",
        });
        assert(restartedProcess.status === 0, `Expected app-process restart behavior to begin logged out with no persisted admin session. stderr: ${restartedProcess.stderr}`);
    }
    finally {
        console.warn = originalWarn;
    }
}
runEntryGateTests()
    .then(() => {
    console.log("entry-gating.spec.ts passed");
})
    .catch((error) => {
    console.error("entry-gating.spec.ts failed");
    console.error(error);
    throw error;
});
