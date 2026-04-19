import CerniqDomain
import Foundation

public enum ALMRouteStyle: String, Equatable, Sendable {
    case frontendObserved
    case documented
}

public struct CerniqAPIEnvironment: Equatable, Sendable {
    public let baseURL: URL
    public let almRouteStyle: ALMRouteStyle

    public init(baseURL: URL, almRouteStyle: ALMRouteStyle = .frontendObserved) {
        self.baseURL = baseURL
        self.almRouteStyle = almRouteStyle
    }
}

public enum HTTPMethod: String, Sendable {
    case get = "GET"
    case post = "POST"
}

public struct RequestBody: Sendable {
    public let data: Data
    public let contentType: String

    public init(data: Data, contentType: String = "application/json") {
        self.data = data
        self.contentType = contentType
    }

    public static func json<T: Encodable>(_ value: T, encoder: JSONEncoder = JSONEncoder()) throws -> RequestBody {
        RequestBody(data: try encoder.encode(value))
    }
}

public struct APIRequest<Response: Decodable & Sendable>: Sendable {
    public let path: String
    public let method: HTTPMethod
    public let queryItems: [URLQueryItem]
    public let body: RequestBody?
    public let requiresAuthorization: Bool

    public init(
        path: String,
        method: HTTPMethod = .get,
        queryItems: [URLQueryItem] = [],
        body: RequestBody? = nil,
        requiresAuthorization: Bool = true
    ) {
        self.path = path
        self.method = method
        self.queryItems = queryItems
        self.body = body
        self.requiresAuthorization = requiresAuthorization
    }
}

public protocol NetworkSession: Sendable {
    func data(for request: URLRequest) async throws -> (Data, URLResponse)
}

extension URLSession: NetworkSession {}

public enum APIError: Error, Equatable {
    case invalidURL
    case invalidResponse
    case httpStatus(Int, String)
    case decoding(String)
}

public struct PaginatedResponse<Item: Codable & Equatable & Sendable>: Codable, Equatable, Sendable {
    public let items: [Item]
    public let total: Int
    public let page: Int
    public let pageSize: Int
    public let totalPages: Int

    public init(
        items: [Item],
        total: Int,
        page: Int,
        pageSize: Int,
        totalPages: Int
    ) {
        self.items = items
        self.total = total
        self.page = page
        self.pageSize = pageSize
        self.totalPages = totalPages
    }
}

private struct ResponseEnvelope<Payload: Decodable & Sendable>: Decodable {
    let success: Bool?
    let data: Payload?
    let error: ErrorEnvelope?
}

private struct ErrorEnvelope: Decodable {
    let message: String?
}

public struct CerniqAPIClient: Sendable {
    public let environment: CerniqAPIEnvironment
    private let session: NetworkSession
    private let decoder: JSONDecoder

    public init(
        environment: CerniqAPIEnvironment,
        session: NetworkSession = URLSession.shared
    ) {
        self.environment = environment
        self.session = session
        self.decoder = JSONDecoder()
        self.decoder.keyDecodingStrategy = .convertFromSnakeCase
    }

    public func makeURLRequest<Response>(
        for request: APIRequest<Response>,
        accessToken: String? = nil
    ) throws -> URLRequest {
        guard var components = URLComponents(
            url: environment.baseURL.appendingPathComponent(request.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))),
            resolvingAgainstBaseURL: false
        ) else {
            throw APIError.invalidURL
        }

        if !request.queryItems.isEmpty {
            components.queryItems = request.queryItems
        }

        guard let url = components.url else {
            throw APIError.invalidURL
        }

        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = request.method.rawValue
        urlRequest.httpShouldHandleCookies = true
        urlRequest.setValue("application/json", forHTTPHeaderField: "Accept")

        if request.requiresAuthorization, let accessToken, !accessToken.isEmpty {
            urlRequest.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        }

        if let body = request.body {
            urlRequest.httpBody = body.data
            urlRequest.setValue(body.contentType, forHTTPHeaderField: "Content-Type")
        }

        return urlRequest
    }

    public func send<Response: Decodable>(
        _ request: APIRequest<Response>,
        accessToken: String? = nil
    ) async throws -> Response {
        let urlRequest = try makeURLRequest(for: request, accessToken: accessToken)
        let (data, response) = try await session.data(for: urlRequest)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        guard (200 ..< 300).contains(httpResponse.statusCode) else {
            let message = decodeErrorMessage(from: data) ?? HTTPURLResponse.localizedString(forStatusCode: httpResponse.statusCode)
            throw APIError.httpStatus(httpResponse.statusCode, message)
        }

        do {
            let envelope = try decoder.decode(ResponseEnvelope<Response>.self, from: data)
            if let payload = envelope.data {
                return payload
            }
        } catch {
            // Fall through to direct payload decoding.
        }

        do {
            return try decoder.decode(Response.self, from: data)
        } catch {
            throw APIError.decoding(String(describing: error))
        }
    }

    private func decodeErrorMessage(from data: Data) -> String? {
        if let envelope = try? decoder.decode(ResponseEnvelope<EmptyPayload>.self, from: data) {
            return envelope.error?.message
        }

        if let string = String(data: data, encoding: .utf8), !string.isEmpty {
            return string
        }

        return nil
    }
}

public struct EmptyPayload: Codable, Equatable, Sendable {
    public init() {}
}

public enum AuthAPI {
    public struct AuthEnvelope: Codable, Equatable, Sendable {
        public let user: AuthUser
        public let accessToken: String?
        public let refreshToken: String?

        public init(user: AuthUser, accessToken: String?, refreshToken: String?) {
            self.user = user
            self.accessToken = accessToken
            self.refreshToken = refreshToken
        }
    }

    private struct Credentials: Encodable {
        let email: String
        let password: String
    }

    private struct RefreshPayload: Encodable {
        let refreshToken: String?
    }

    public static func login(email: String, password: String) throws -> APIRequest<AuthEnvelope> {
        APIRequest(
            path: "/api/auth/login",
            method: .post,
            body: try RequestBody.json(Credentials(email: email.lowercased(), password: password)),
            requiresAuthorization: false
        )
    }

    public static func refresh(refreshToken: String? = nil) throws -> APIRequest<AuthEnvelope> {
        let body = try RequestBody.json(RefreshPayload(refreshToken: refreshToken))
        return APIRequest(
            path: "/api/auth/refresh",
            method: .post,
            body: body,
            requiresAuthorization: false
        )
    }

    public static func profile() -> APIRequest<AuthUser> {
        APIRequest(path: "/api/auth/profile")
    }
}

public enum PortalAPI {
    public static func settings() -> APIRequest<PortalSettingsSnapshot> {
        APIRequest(path: "/api/portal/settings")
    }

    public static func reportJobs() -> APIRequest<[PortalReportJob]> {
        APIRequest(path: "/api/portal/jobs")
    }

    public static func exportManifests(jobID: String) -> APIRequest<[DocumentExportManifest]> {
        APIRequest(path: "/api/portal/jobs/\(jobID)/exports")
    }
}

public enum ALMAPI {
    public static func listInstitutions() -> APIRequest<PaginatedResponse<InstitutionSummary>> {
        APIRequest(path: "/api/alm/institutions")
    }

    public static func summary(
        institutionID: String,
        routeStyle: ALMRouteStyle
    ) -> APIRequest<ALMSummary> {
        let path: String
        switch routeStyle {
        case .frontendObserved:
            path = "/api/alm/\(institutionID)/summary"
        case .documented:
            path = "/api/alm/institutions/\(institutionID)/summary"
        }

        return APIRequest(path: path)
    }
}
