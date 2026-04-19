import XCTest
@testable import CerniqAPI
@testable import CerniqAuth
@testable import CerniqFeatures

private struct MockNetworkSession: NetworkSession {
    let handler: @Sendable (URLRequest) async throws -> (Data, URLResponse)

    func data(for request: URLRequest) async throws -> (Data, URLResponse) {
        try await handler(request)
    }
}

final class CerniqFeaturesTests: XCTestCase {
    @MainActor
    func testAppStateResolvesURLsAndPersistsSelection() {
        let suiteName = "io.cerniq.tests.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suiteName)!
        defer {
            defaults.removePersistentDomain(forName: suiteName)
        }

        let appState = CerniqAppState(platform: .macOS, defaults: defaults)
        appState.selectedEnvironment = .local
        appState.select(.submitData)

        XCTAssertEqual(appState.environmentDescription, "http://localhost:3001")
        XCTAssertEqual(appState.currentURL.absoluteString, "http://localhost:3001/portal/submit")

        let restored = CerniqAppState(platform: .macOS, defaults: defaults)
        XCTAssertEqual(restored.selectedEnvironment, .local)
        XCTAssertEqual(restored.selectedDestination, .submitData)
    }

    @MainActor
    func testLiveOverviewFallsBackWhenSettingsEndpointFails() async throws {
        let session = MockNetworkSession { request in
            let path = request.url?.path ?? ""

            switch path {
            case "/api/auth/profile":
                return try (Self.fixture(named: "auth-profile.json"), Self.response(for: request))
            case "/api/alm/institutions":
                return try (Self.fixture(named: "institutions.json"), Self.response(for: request))
            case "/api/portal/settings":
                return try (
                    Data("{\"error\":{\"message\":\"missing settings\"}}".utf8),
                    Self.response(for: request, statusCode: 404)
                )
            case "/api/alm/inst_123/summary":
                return try (Self.fixture(named: "alm-summary.json"), Self.response(for: request))
            default:
                XCTFail("Unexpected request path \(path)")
                throw NSError(domain: "CerniqFeaturesTests", code: 1)
            }
        }

        let client = CerniqAPIClient(
            environment: CerniqAPIEnvironment(baseURL: URL(string: "https://api.cerniq.io")!),
            session: session
        )
        let authManager = AuthSessionManager(client: client, credentialStore: InMemoryCredentialStore())
        let service = LiveWorkspaceOverviewService(client: client, authManager: authManager)

        let snapshot = try await service.fetchOverview()

        XCTAssertEqual(snapshot.settings.workspaceName, "CoopAhorro Workspace")
        XCTAssertEqual(snapshot.settings.institutionName, "CoopAhorro San Juan")
        XCTAssertEqual(snapshot.institutions.count, 2)
    }

    @MainActor
    func testIncomingReportExportURLMapsToReportsDestination() {
        let suiteName = "io.cerniq.tests.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suiteName)!
        defer {
            defaults.removePersistentDomain(forName: suiteName)
        }

        let appState = CerniqAppState(platform: .iOS, defaults: defaults)

        appState.applyIncomingURL(URL(string: "https://cerniq.io/api/portal/jobs/job_123/exports?download=1")!)

        XCTAssertEqual(appState.selectedDestination, .reports)
        XCTAssertEqual(appState.currentURL.absoluteString, "https://cerniq.io/portal/reports/job_123")
        XCTAssertEqual(appState.browserTitle, "Reports")
    }

    @MainActor
    func testCustomEnvironmentSanitizesBaseURLAndPersistsResolvedDestination() {
        let suiteName = "io.cerniq.tests.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suiteName)!
        defer {
            defaults.removePersistentDomain(forName: suiteName)
        }

        let appState = CerniqAppState(platform: .macOS, defaults: defaults)
        appState.selectedEnvironment = .custom
        appState.customBaseURL = " https://preview.cerniq.internal/// "
        appState.select(.settings)

        XCTAssertEqual(appState.environmentDescription, "https://preview.cerniq.internal")
        XCTAssertEqual(appState.currentURL.absoluteString, "https://preview.cerniq.internal/portal/settings")

        let restored = CerniqAppState(platform: .macOS, defaults: defaults)
        XCTAssertEqual(restored.selectedEnvironment, .custom)
        XCTAssertEqual(restored.environmentDescription, "https://preview.cerniq.internal")
        XCTAssertEqual(restored.selectedDestination, .settings)
    }

    private static func fixture(named name: String) throws -> Data {
        let root = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
        return try Data(contentsOf: root.appending(path: "Fixtures").appending(path: name))
    }

    private static func response(for request: URLRequest, statusCode: Int = 200) throws -> URLResponse {
        try XCTUnwrap(
            HTTPURLResponse(
                url: XCTUnwrap(request.url),
                statusCode: statusCode,
                httpVersion: nil,
                headerFields: nil
            )
        )
    }
}
