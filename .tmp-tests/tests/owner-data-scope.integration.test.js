"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_library_1 = require("expo-router/testing-library");
const react_native_1 = require("@testing-library/react-native");
const admin_session_1 = require("@/domain/services/admin-session");
const mockGetOwnerScopedSnapshot = jest.fn();
const mockCreateShopper = jest.fn();
const mockUpdateShopper = jest.fn();
const originalConsoleError = console.error;
jest.mock("@/domain/services/owner-data-service", () => ({
    getOwnerScopedSnapshot: (...args) => mockGetOwnerScopedSnapshot(...args),
    createProduct: jest.fn(),
    createShopper: (...args) => mockCreateShopper(...args),
    addShoppingListItem: jest.fn(),
    recordPurchase: jest.fn(),
    recordPayment: jest.fn(),
    updateProduct: jest.fn(),
    updateShopper: (...args) => mockUpdateShopper(...args),
    updateShoppingListItem: jest.fn(),
}));
const ROUTES = {
    "(admin)/_layout": require("../src/app/(admin)/_layout").default,
    "(admin)/owner-data": require("../src/app/(admin)/owner-data").default,
};
async function renderOwnerDataRoute() {
    (0, testing_library_1.renderRouter)(ROUTES, { initialUrl: "/owner-data" });
    await (0, react_native_1.act)(async () => {
        await Promise.resolve();
    });
}
describe("owner-data owner-scope integration", () => {
    let consoleErrorSpy;
    beforeAll(() => {
        consoleErrorSpy = jest.spyOn(console, "error").mockImplementation((...args) => {
            const firstArg = args[0];
            if (typeof firstArg === "string" &&
                firstArg.includes("inside a test was not wrapped in act(...)")) {
                return;
            }
            originalConsoleError(...args);
        });
    });
    afterAll(() => {
        consoleErrorSpy.mockRestore();
    });
    beforeEach(() => {
        jest.clearAllMocks();
        (0, admin_session_1.clearAdminSession)();
        (0, admin_session_1.setAdminSession)({ id: 1, username: "admin" });
        (0, admin_session_1.setActiveOwner)({ id: 101, name: "Owner A" });
        mockGetOwnerScopedSnapshot.mockImplementation(() => {
            const activeOwner = require("@/domain/services/admin-session").getActiveOwner();
            if (activeOwner?.id === 101) {
                return Promise.resolve({
                    ok: true,
                    value: {
                        products: [
                            {
                                id: 1,
                                ownerId: 101,
                                name: "Product A",
                                barcode: "A-1",
                                createdAtMs: 1,
                                updatedAtMs: 1,
                            },
                        ],
                        shoppers: [],
                        shoppingList: [],
                        purchases: [],
                        payments: [],
                        history: [],
                    },
                });
            }
            return Promise.resolve({
                ok: true,
                value: {
                    products: [
                        {
                            id: 2,
                            ownerId: 202,
                            name: "Product B",
                            barcode: "B-1",
                            createdAtMs: 2,
                            updatedAtMs: 2,
                        },
                    ],
                    shoppers: [],
                    shoppingList: [],
                    purchases: [],
                    payments: [],
                    history: [],
                },
            });
        });
        mockCreateShopper.mockResolvedValue({
            ok: true,
            value: {
                id: 1,
                ownerId: 101,
                name: "Shopper A",
                createdAtMs: 1,
                updatedAtMs: 1,
            },
        });
        mockUpdateShopper.mockResolvedValue({
            ok: true,
            value: {
                id: 1,
                ownerId: 101,
                name: "Renamed Shopper",
                createdAtMs: 1,
                updatedAtMs: 2,
            },
        });
    });
    it("swaps visible data deterministically when active owner changes", async () => {
        await renderOwnerDataRoute();
        await (0, testing_library_1.waitFor)(() => {
            expect(testing_library_1.screen.getByText("Active owner: Owner A")).toBeTruthy();
            expect(testing_library_1.screen.getByText("Product A")).toBeTruthy();
        });
        (0, react_native_1.act)(() => {
            (0, admin_session_1.setActiveOwner)({ id: 202, name: "Owner B" });
        });
        await (0, testing_library_1.waitFor)(() => {
            expect(testing_library_1.screen.getByText("Active owner: Owner B")).toBeTruthy();
            expect(testing_library_1.screen.getByText("Product B")).toBeTruthy();
        });
        expect(testing_library_1.screen.queryByText("Product A")).toBeFalsy();
    });
    it("validates shopper pin format before create requests", async () => {
        await renderOwnerDataRoute();
        await (0, testing_library_1.waitFor)(() => {
            expect(testing_library_1.screen.getByText("Active owner: Owner A")).toBeTruthy();
        });
        react_native_1.fireEvent.changeText(testing_library_1.screen.getByLabelText("Shopper Name"), "Shopper A");
        react_native_1.fireEvent.changeText(testing_library_1.screen.getByLabelText("Shopper PIN"), "12a");
        react_native_1.fireEvent.press(testing_library_1.screen.getByText("Create Shopper"));
        expect(mockCreateShopper).not.toHaveBeenCalled();
        expect(testing_library_1.screen.getByText("Shopper PIN must be at least 4 digits.")).toBeTruthy();
    });
    it("requires shopper pin before create requests", async () => {
        await renderOwnerDataRoute();
        await (0, testing_library_1.waitFor)(() => {
            expect(testing_library_1.screen.getByText("Active owner: Owner A")).toBeTruthy();
        });
        react_native_1.fireEvent.changeText(testing_library_1.screen.getByLabelText("Shopper Name"), "Shopper A");
        react_native_1.fireEvent.press(testing_library_1.screen.getByText("Create Shopper"));
        expect(mockCreateShopper).not.toHaveBeenCalled();
        expect(testing_library_1.screen.getByText("Shopper PIN must be at least 4 digits.")).toBeTruthy();
    });
    it("does not send pin updates for name-only shopper edits", async () => {
        mockGetOwnerScopedSnapshot.mockResolvedValueOnce({
            ok: true,
            value: {
                products: [
                    {
                        id: 1,
                        ownerId: 101,
                        name: "Product A",
                        barcode: "A-1",
                        createdAtMs: 1,
                        updatedAtMs: 1,
                    },
                ],
                shoppers: [
                    {
                        id: 77,
                        ownerId: 101,
                        name: "Shopper A",
                        createdAtMs: 1,
                        updatedAtMs: 1,
                    },
                ],
                shoppingList: [],
                purchases: [],
                payments: [],
                history: [],
            },
        });
        await renderOwnerDataRoute();
        await (0, testing_library_1.waitFor)(() => {
            expect(testing_library_1.screen.getByText("Active owner: Owner A")).toBeTruthy();
        });
        react_native_1.fireEvent.changeText(testing_library_1.screen.getByLabelText("Rename Shopper"), "Renamed Shopper");
        react_native_1.fireEvent.press(testing_library_1.screen.getByText("Edit First Shopper"));
        await (0, testing_library_1.waitFor)(() => {
            expect(mockUpdateShopper).toHaveBeenCalledWith({
                shopperId: 77,
                name: "Renamed Shopper",
            });
        });
    });
});
