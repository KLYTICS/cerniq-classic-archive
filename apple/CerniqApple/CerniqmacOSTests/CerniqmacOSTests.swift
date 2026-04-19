import XCTest
@testable import CerniqFeatures

final class CerniqmacOSTests: XCTestCase {
    @MainActor
    func testMacAppStateDefaultsToHomeDestination() {
        let suiteName = "io.cerniq.xcode.tests.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suiteName)!
        defer {
            defaults.removePersistentDomain(forName: suiteName)
        }

        let appState = CerniqAppState(platform: .macOS, defaults: defaults)

        XCTAssertEqual(appState.selectedDestination, .home)
        XCTAssertEqual(appState.environmentDescription, "https://cerniq.io")
    }

    @MainActor
    func testMacAppStateResetEnvironmentRestoresProductionDefaults() {
        let suiteName = "io.cerniq.xcode.tests.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suiteName)!
        defer {
            defaults.removePersistentDomain(forName: suiteName)
        }

        let appState = CerniqAppState(platform: .macOS, defaults: defaults)
        appState.selectedEnvironment = .custom
        appState.customBaseURL = "https://ops.cerniq.internal"
        appState.openExternalLinksInBrowser = true

        appState.resetEnvironment()

        XCTAssertEqual(appState.selectedEnvironment, .production)
        XCTAssertEqual(appState.customBaseURL, "")
        XCTAssertFalse(appState.openExternalLinksInBrowser)
        XCTAssertEqual(appState.environmentDescription, "https://cerniq.io")
    }
}
