import XCTest
@testable import CerniqFeatures

final class CerniqiOSTests: XCTestCase {
    @MainActor
    func testIOSAppStateDefaultsToReportsDestination() {
        let suiteName = "io.cerniq.ios.tests.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suiteName)!
        defer {
            defaults.removePersistentDomain(forName: suiteName)
        }

        let appState = CerniqAppState(platform: .iOS, defaults: defaults)

        XCTAssertEqual(appState.selectedDestination, .reports)
        XCTAssertEqual(appState.environmentDescription, "https://cerniq.io")
    }

    @MainActor
    func testIOSAppStatePersistsCustomEnvironmentSelection() {
        let suiteName = "io.cerniq.ios.tests.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suiteName)!
        defer {
            defaults.removePersistentDomain(forName: suiteName)
        }

        let appState = CerniqAppState(platform: .iOS, defaults: defaults)
        appState.selectedEnvironment = .custom
        appState.customBaseURL = "https://preview.cerniq.internal/"

        let restored = CerniqAppState(platform: .iOS, defaults: defaults)

        XCTAssertEqual(restored.selectedEnvironment, .custom)
        XCTAssertEqual(restored.environmentDescription, "https://preview.cerniq.internal")
        XCTAssertEqual(restored.currentURL.absoluteString, "https://preview.cerniq.internal/portal")
    }
}
