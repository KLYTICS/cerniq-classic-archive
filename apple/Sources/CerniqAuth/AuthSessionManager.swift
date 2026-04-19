import CerniqAPI
import CerniqDomain
import Foundation
import Security

public enum AuthError: Error, Equatable {
    case keychain(OSStatus)
}

public protocol CredentialStore: Sendable {
    func loadAccessToken() throws -> String?
    func loadRefreshToken() throws -> String?
    func store(accessToken: String?, refreshToken: String?) throws
    func clear() throws
}

public final class InMemoryCredentialStore: CredentialStore, @unchecked Sendable {
    private var accessToken: String?
    private var refreshToken: String?

    public init(accessToken: String? = nil, refreshToken: String? = nil) {
        self.accessToken = accessToken
        self.refreshToken = refreshToken
    }

    public func loadAccessToken() throws -> String? {
        accessToken
    }

    public func loadRefreshToken() throws -> String? {
        refreshToken
    }

    public func store(accessToken: String?, refreshToken: String?) throws {
        self.accessToken = accessToken
        self.refreshToken = refreshToken
    }

    public func clear() throws {
        accessToken = nil
        refreshToken = nil
    }
}

public final class KeychainCredentialStore: CredentialStore, @unchecked Sendable {
    private let service: String
    private let accessAccount = "access-token"
    private let refreshAccount = "refresh-token"

    public init(service: String = "io.cerniq.apple") {
        self.service = service
    }

    public func loadAccessToken() throws -> String? {
        try load(account: accessAccount)
    }

    public func loadRefreshToken() throws -> String? {
        try load(account: refreshAccount)
    }

    public func store(accessToken: String?, refreshToken: String?) throws {
        try store(value: accessToken, account: accessAccount)
        try store(value: refreshToken, account: refreshAccount)
    }

    public func clear() throws {
        try store(value: nil, account: accessAccount)
        try store(value: nil, account: refreshAccount)
    }

    private func load(account: String) throws -> String? {
        let query: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: account,
            kSecReturnData: true,
            kSecMatchLimit: kSecMatchLimitOne,
        ]

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)

        switch status {
        case errSecSuccess:
            guard let data = item as? Data else { return nil }
            return String(data: data, encoding: .utf8)
        case errSecItemNotFound:
            return nil
        default:
            throw AuthError.keychain(status)
        }
    }

    private func store(value: String?, account: String) throws {
        let query: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: account,
        ]

        SecItemDelete(query as CFDictionary)

        guard let value else {
            return
        }

        let data = Data(value.utf8)
        let attributes: [CFString: Any] = query.merging([
            kSecValueData: data,
        ]) { _, new in
            new
        }

        let status = SecItemAdd(attributes as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw AuthError.keychain(status)
        }
    }
}

public final class AuthSessionManager: @unchecked Sendable {
    private let client: CerniqAPIClient
    private let credentialStore: CredentialStore
    private let cookieStorage: HTTPCookieStorage

    public private(set) var session: AuthSession?

    public init(
        client: CerniqAPIClient,
        credentialStore: CredentialStore = InMemoryCredentialStore(),
        cookieStorage: HTTPCookieStorage = .shared
    ) {
        self.client = client
        self.credentialStore = credentialStore
        self.cookieStorage = cookieStorage
    }

    public func accessToken() throws -> String? {
        try credentialStore.loadAccessToken()
    }

    @discardableResult
    public func login(email: String, password: String) async throws -> AuthSession {
        let response = try await client.send(try AuthAPI.login(email: email, password: password))
        return try apply(response: response)
    }

    @discardableResult
    public func refreshSession() async throws -> AuthSession {
        if let refreshToken = try credentialStore.loadRefreshToken() {
            let response = try await client.send(try AuthAPI.refresh(refreshToken: refreshToken))
            return try apply(response: response, fallbackRefreshToken: refreshToken)
        }

        let user = try await client.send(AuthAPI.profile())
        let session = AuthSession(
            user: user,
            accessToken: nil,
            refreshToken: nil,
            authenticationMode: .cookieBacked
        )
        self.session = session
        return session
    }

    public func loadProfile() async throws -> AuthUser {
        let token = try credentialStore.loadAccessToken()
        return try await client.send(AuthAPI.profile(), accessToken: token)
    }

    public func logout() throws {
        session = nil
        try credentialStore.clear()
        cookieStorage.removeCookies(since: .distantPast)
    }

    private func apply(
        response: AuthAPI.AuthEnvelope,
        fallbackRefreshToken: String? = nil
    ) throws -> AuthSession {
        let resolvedRefreshToken = response.refreshToken ?? fallbackRefreshToken
        let hasTokenContract = response.accessToken != nil || resolvedRefreshToken != nil
        let mode: AuthenticationMode = hasTokenContract ? .tokenBacked : .cookieBacked

        if hasTokenContract {
            try credentialStore.store(
                accessToken: response.accessToken,
                refreshToken: resolvedRefreshToken
            )
        } else {
            try credentialStore.clear()
        }

        let session = AuthSession(
            user: response.user,
            accessToken: response.accessToken,
            refreshToken: resolvedRefreshToken,
            authenticationMode: mode
        )

        self.session = session
        return session
    }
}
