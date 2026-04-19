import XCTest
@testable import CerniqAPI
@testable import CerniqAuth

private struct MockNetworkSession: NetworkSession {
    let handler: @Sendable (URLRequest) async throws -> (Data, URLResponse)

    func data(for request: URLRequest) async throws -> (Data, URLResponse) {
        try await handler(request)
    }
}

final class CerniqAuthTests: XCTestCase {
    func testCookieBackedLoginClearsStoredTokens() async throws {
        let session = MockNetworkSession { request in
            let data = try Self.fixture(named: "auth-login.json")
            return try (data, Self.response(for: request))
        }

        let client = CerniqAPIClient(
            environment: CerniqAPIEnvironment(baseURL: URL(string: "https://api.cerniq.io")!),
            session: session
        )
        let store = InMemoryCredentialStore(accessToken: "stale-access", refreshToken: "stale-refresh")
        let authManager = AuthSessionManager(client: client, credentialStore: store)

        let sessionResult = try await authManager.login(email: "ana@coop.pr", password: "secret")

        XCTAssertEqual(sessionResult.authenticationMode, .cookieBacked)
        XCTAssertNil(try store.loadAccessToken())
        XCTAssertNil(try store.loadRefreshToken())
    }

    func testRefreshSessionPreservesTokenBackedModeWhenTokensReturned() async throws {
        let session = MockNetworkSession { request in
            let path = request.url?.path ?? ""
            let data: Data

            switch path {
            case "/api/auth/refresh":
                data = try Self.fixture(named: "auth-refresh.json")
            case "/api/auth/profile":
                data = try Self.fixture(named: "auth-profile.json")
            default:
                XCTFail("Unexpected request path \(path)")
                throw NSError(domain: "CerniqAuthTests", code: 1)
            }

            return try (data, Self.response(for: request))
        }

        let client = CerniqAPIClient(
            environment: CerniqAPIEnvironment(baseURL: URL(string: "https://api.cerniq.io")!),
            session: session
        )
        let store = InMemoryCredentialStore(refreshToken: "rt_123")
        let authManager = AuthSessionManager(client: client, credentialStore: store)

        let sessionResult = try await authManager.refreshSession()

        XCTAssertEqual(sessionResult.authenticationMode, .tokenBacked)
        XCTAssertEqual(try store.loadAccessToken(), "at_456")
        XCTAssertEqual(try store.loadRefreshToken(), "rt_456")
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
