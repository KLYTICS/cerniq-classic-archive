import XCTest
@testable import CerniqAPI
@testable import CerniqDomain

private struct MockNetworkSession: NetworkSession {
    let handler: @Sendable (URLRequest) async throws -> (Data, URLResponse)

    func data(for request: URLRequest) async throws -> (Data, URLResponse) {
        try await handler(request)
    }
}

final class CerniqAPITests: XCTestCase {
    func testLoginRequestNormalizesEmail() throws {
        let client = CerniqAPIClient(
            environment: CerniqAPIEnvironment(baseURL: URL(string: "https://api.cerniq.io")!)
        )

        let request = try client.makeURLRequest(
            for: try AuthAPI.login(email: "ANA@COOP.PR", password: "secret")
        )

        let body = try XCTUnwrap(
            JSONSerialization.jsonObject(with: XCTUnwrap(request.httpBody)) as? [String: String]
        )

        XCTAssertEqual(request.url?.absoluteString, "https://api.cerniq.io/api/auth/login")
        XCTAssertEqual(body["email"], "ana@coop.pr")
        XCTAssertEqual(body["password"], "secret")
        XCTAssertTrue(request.httpShouldHandleCookies)
    }

    func testListInstitutionsDecodesPaginatedEnvelope() async throws {
        let session = MockNetworkSession { request in
            let data = try Self.fixture(named: "institutions.json")
            return try (data, Self.response(for: request))
        }

        let client = CerniqAPIClient(
            environment: CerniqAPIEnvironment(baseURL: URL(string: "https://api.cerniq.io")!),
            session: session
        )

        let page = try await client.send(ALMAPI.listInstitutions())

        XCTAssertEqual(page.items.count, 2)
        XCTAssertEqual(page.total, 2)
        XCTAssertEqual(page.items.first?.id, "inst_123")
    }

    func testSummaryRouteStylesGenerateExpectedPaths() throws {
        let client = CerniqAPIClient(
            environment: CerniqAPIEnvironment(baseURL: URL(string: "https://api.cerniq.io")!)
        )

        let frontendObserved = try client.makeURLRequest(
            for: ALMAPI.summary(institutionID: "inst_123", routeStyle: .frontendObserved)
        )
        let documented = try client.makeURLRequest(
            for: ALMAPI.summary(institutionID: "inst_123", routeStyle: .documented)
        )

        XCTAssertEqual(frontendObserved.url?.path, "/api/alm/inst_123/summary")
        XCTAssertEqual(documented.url?.path, "/api/alm/institutions/inst_123/summary")
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
