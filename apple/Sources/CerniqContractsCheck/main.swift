import CerniqAPI
import CerniqAuth
import CerniqDomain
import CerniqFeatures
import Foundation

private struct MockNetworkSession: NetworkSession {
    let handler: @Sendable (URLRequest) async throws -> (Data, URLResponse)

    func data(for request: URLRequest) async throws -> (Data, URLResponse) {
        try await handler(request)
    }
}

private final class TelemetryRecorder: @unchecked Sendable {
    private(set) var events: [CerniqTelemetryEvent] = []

    func append(_ event: CerniqTelemetryEvent) {
        events.append(event)
    }
}

private enum VerificationError: Error, CustomStringConvertible {
    case failed(String)

    var description: String {
        switch self {
        case .failed(let message):
            return message
        }
    }
}

@main
struct CerniqContractsCheck {
    static func main() async throws {
        try verifyLoginRequest()
        try verifyALMSummaryRouteStyles()
        try await verifyCookieBackedLogin()
        try await verifyTokenRefreshFallback()
        try await verifyLiveOverviewComposition()
        try await verifySettingsFallbackWhenEndpointFails()
        try await verifyAppSessionContainerFlow()
        try await verifyOfflineLastOverviewFallback()
        print("CerniqContractsCheck passed")
    }

    private static func verifyLoginRequest() throws {
        let client = CerniqAPIClient(
            environment: CerniqAPIEnvironment(baseURL: URL(string: "https://api.cerniq.io")!)
        )

        let request = try client.makeURLRequest(
            for: try AuthAPI.login(email: "ANA@COOP.PR", password: "secret")
        )

        try expect(request.url?.absoluteString == "https://api.cerniq.io/api/auth/login", "login URL drifted")
        try expect(request.httpMethod == "POST", "login method drifted")
        try expect(request.httpShouldHandleCookies, "login requests should preserve cookie handling")

        let body = try JSONSerialization.jsonObject(with: request.httpBody ?? Data()) as? [String: String]
        try expect(body?["email"] == "ana@coop.pr", "login email normalization drifted")
        try expect(body?["password"] == "secret", "login body drifted")
    }

    private static func verifyALMSummaryRouteStyles() throws {
        let client = CerniqAPIClient(
            environment: CerniqAPIEnvironment(baseURL: URL(string: "https://api.cerniq.io")!)
        )

        let frontendObserved = try client.makeURLRequest(
            for: ALMAPI.summary(institutionID: "inst_123", routeStyle: .frontendObserved)
        )
        let documented = try client.makeURLRequest(
            for: ALMAPI.summary(institutionID: "inst_123", routeStyle: .documented)
        )

        try expect(
            frontendObserved.url?.path == "/api/alm/inst_123/summary",
            "frontend-observed ALM summary route drifted"
        )
        try expect(
            documented.url?.path == "/api/alm/institutions/inst_123/summary",
            "documented ALM summary route drifted"
        )
    }

    private static func verifyCookieBackedLogin() async throws {
        let session = MockNetworkSession { request in
            let data = try fixture(named: "auth-login.json")
            return try (data, response(for: request))
        }

        let client = CerniqAPIClient(
            environment: CerniqAPIEnvironment(baseURL: URL(string: "https://api.cerniq.io")!),
            session: session
        )
        let store = InMemoryCredentialStore()
        let authManager = AuthSessionManager(client: client, credentialStore: store)

        let result = try await authManager.login(email: "ana@coop.pr", password: "secret")

        try expect(result.authenticationMode == .cookieBacked, "login should default to cookie-backed sessions")
        try expect(try store.loadAccessToken() == nil, "cookie-backed login should not persist an access token")
        try expect(try store.loadRefreshToken() == nil, "cookie-backed login should not persist a refresh token")
    }

    private static func verifyTokenRefreshFallback() async throws {
        let session = MockNetworkSession { request in
            let path = request.url?.path ?? ""
            let data: Data

            switch path {
            case "/api/auth/refresh":
                data = try fixture(named: "auth-refresh.json")
            case "/api/auth/profile":
                data = try fixture(named: "auth-profile.json")
            default:
                throw VerificationError.failed("unexpected refresh request path: \(path)")
            }

            return try (data, response(for: request))
        }

        let client = CerniqAPIClient(
            environment: CerniqAPIEnvironment(baseURL: URL(string: "https://api.cerniq.io")!),
            session: session
        )
        let store = InMemoryCredentialStore(refreshToken: "rt_123")
        let authManager = AuthSessionManager(client: client, credentialStore: store)

        let result = try await authManager.refreshSession()

        try expect(result.authenticationMode == .tokenBacked, "refresh should preserve token-backed mode when tokens are returned")
        try expect(try store.loadAccessToken() == "at_456", "refresh should persist the refreshed access token")
        try expect(try store.loadRefreshToken() == "rt_456", "refresh should persist the refreshed refresh token")
    }

    private static func verifyLiveOverviewComposition() async throws {
        let session = MockNetworkSession { request in
            let path = request.url?.path ?? ""
            let fixtureName: String

            switch path {
            case "/api/auth/profile":
                fixtureName = "auth-profile.json"
            case "/api/alm/institutions":
                fixtureName = "institutions.json"
            case "/api/portal/settings":
                fixtureName = "portal-settings.json"
            case "/api/alm/inst_123/summary":
                fixtureName = "alm-summary.json"
            default:
                throw VerificationError.failed("unexpected request path: \(path)")
            }

            let data = try fixture(named: fixtureName)
            return try (data, response(for: request))
        }

        let client = CerniqAPIClient(
            environment: CerniqAPIEnvironment(baseURL: URL(string: "https://api.cerniq.io")!),
            session: session
        )
        let authManager = AuthSessionManager(client: client, credentialStore: InMemoryCredentialStore())
        let service = await MainActor.run {
            LiveWorkspaceOverviewService(client: client, authManager: authManager)
        }
        let snapshot = try await service.fetchOverview()

        try expect(snapshot.user.email == "ana@coop.pr", "profile decoding drifted")
        try expect(snapshot.institutions.count == 2, "paginated institutions decoding drifted")
        try expect(snapshot.settings.subscriptionTier == "annual", "portal settings decoding drifted")
        try expect(
            snapshot.highlights.contains(where: { $0.id == "duration-gap" && $0.value == "1.80" }),
            "overview highlight generation drifted"
        )
        try expect(snapshot.summary?.liquidityCoverageRatio == 115.5, "ALM summary decoding drifted")
    }

    private static func verifySettingsFallbackWhenEndpointFails() async throws {
        let session = MockNetworkSession { request in
            let path = request.url?.path ?? ""

            switch path {
            case "/api/auth/profile":
                return try (fixture(named: "auth-profile.json"), response(for: request))
            case "/api/alm/institutions":
                return try (fixture(named: "institutions.json"), response(for: request))
            case "/api/portal/settings":
                return try (
                    Data("{\"error\":{\"message\":\"missing settings\"}}".utf8),
                    response(for: request, statusCode: 404)
                )
            case "/api/alm/inst_123/summary":
                return try (fixture(named: "alm-summary.json"), response(for: request))
            default:
                throw VerificationError.failed("unexpected fallback request path: \(path)")
            }
        }

        let client = CerniqAPIClient(
            environment: CerniqAPIEnvironment(baseURL: URL(string: "https://api.cerniq.io")!),
            session: session
        )
        let authManager = AuthSessionManager(client: client, credentialStore: InMemoryCredentialStore())
        let service = await MainActor.run {
            LiveWorkspaceOverviewService(client: client, authManager: authManager)
        }
        let snapshot = try await service.fetchOverview()

        try expect(snapshot.settings.workspaceName == "CoopAhorro Workspace", "fallback settings workspace name drifted")
        try expect(snapshot.settings.institutionName == "CoopAhorro San Juan", "fallback settings institution name drifted")
    }

    private static func verifyAppSessionContainerFlow() async throws {
        let telemetry = TelemetryRecorder()
        let cache = InMemoryWorkspaceOverviewSnapshotCache()

        let session = MockNetworkSession { request in
            let path = request.url?.path ?? ""
            let fixtureName: String

            switch path {
            case "/api/auth/login":
                fixtureName = "auth-login.json"
            case "/api/auth/profile":
                fixtureName = "auth-profile.json"
            case "/api/alm/institutions":
                fixtureName = "institutions.json"
            case "/api/portal/settings":
                fixtureName = "portal-settings.json"
            case "/api/alm/inst_123/summary":
                fixtureName = "alm-summary.json"
            case "/api/portal/jobs":
                fixtureName = "portal-jobs.json"
            case "/api/portal/jobs/job-complete/exports":
                fixtureName = "job-exports.json"
            default:
                throw VerificationError.failed("unexpected container request path: \(path)")
            }

            let data = try fixture(named: fixtureName)
            return try (data, response(for: request))
        }

        let container = await MainActor.run {
            CerniqAppSessionContainer(
                environment: CerniqAPIEnvironment(baseURL: URL(string: "https://api.cerniq.io")!),
                networkSession: session,
                credentialStoreSelection: .inMemory,
                snapshotCache: cache,
                telemetry: ClosureTelemetrySink { telemetry.append($0) }
            )
        }

        let sessionResult = try await container.login(email: "ana@coop.pr", password: "secret")
        let overview = try await container.loadOverview()
        let jobs = try await container.loadReportJobs()
        let manifests = try await container.loadExportManifests(for: "job-complete")
        let cachedOverview = try await container.cachedOverview()

        try expect(sessionResult.authenticationMode == .cookieBacked, "container login should prefer cookie-backed auth")
        try expect(overview.source == .live, "container should prefer live overview when available")
        try expect(jobs.first?.exportSummary?.status == .ready, "portal job export summary decoding drifted")
        try expect(manifests.count == 4, "export manifest fetch drifted")
        try expect(
            manifests.contains(where: { $0.kind == .alcoPack && $0.language == .en }),
            "expected EN board-pack manifest"
        )
        try expect(cachedOverview?.snapshot.user.email == "ana@coop.pr", "overview snapshot cache drifted")
        try expect(
            telemetry.events.contains(where: { $0.name == "portal.exports.load.succeeded" }),
            "container telemetry should include export loading events"
        )
    }

    private static func verifyOfflineLastOverviewFallback() async throws {
        let cachedSnapshot = CachedWorkspaceOverviewRecord(
            snapshot: WorkspaceOverviewSnapshot.sample,
            cachedAt: Date(timeIntervalSince1970: 1_713_398_400)
        )
        let cache = InMemoryWorkspaceOverviewSnapshotCache(record: cachedSnapshot)

        let session = MockNetworkSession { request in
            throw VerificationError.failed("offline fallback should not require live success: \(request.url?.path ?? "unknown")")
        }

        let container = await MainActor.run {
            CerniqAppSessionContainer(
                environment: CerniqAPIEnvironment(baseURL: URL(string: "https://api.cerniq.io")!),
                networkSession: session,
                credentialStoreSelection: .inMemory,
                snapshotCache: cache
            )
        }

        let overview = try await container.loadOverview()

        try expect(overview.source == .cached, "offline load should fall back to cached snapshot")
        try expect(
            overview.snapshot.user.email == WorkspaceOverviewSnapshot.sample.user.email,
            "cached overview fallback drifted"
        )
    }

    private static func fixture(named name: String) throws -> Data {
        let root = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
        return try Data(contentsOf: root.appending(path: "Fixtures").appending(path: name))
    }

    private static func response(
        for request: URLRequest,
        statusCode: Int = 200,
        headerFields: [String: String]? = nil
    ) throws -> URLResponse {
        guard let url = request.url else {
            throw VerificationError.failed("mock request missing URL")
        }

        return HTTPURLResponse(
            url: url,
            statusCode: statusCode,
            httpVersion: nil,
            headerFields: headerFields
        )!
    }

    private static func expect(_ condition: @autoclosure () throws -> Bool, _ message: String) throws {
        if try !condition() {
            throw VerificationError.failed(message)
        }
    }
}
