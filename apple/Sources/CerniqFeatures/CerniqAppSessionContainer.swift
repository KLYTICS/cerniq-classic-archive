import CerniqAPI
import CerniqAuth
import CerniqDomain
import Foundation
import Observation

public enum CredentialStoreSelection: Sendable, Equatable {
    case inMemory
    case keychain(service: String)

    public static let automatic = CredentialStoreSelection.keychain(service: "io.cerniq.apple")

    fileprivate func makeStore() -> any CredentialStore {
        switch self {
        case .inMemory:
            InMemoryCredentialStore()
        case .keychain(let service):
            KeychainCredentialStore(service: service)
        }
    }
}

public struct CerniqTelemetryEvent: Equatable, Sendable {
    public let name: String
    public let metadata: [String: String]
    public let occurredAt: Date

    public init(
        name: String,
        metadata: [String: String] = [:],
        occurredAt: Date = Date()
    ) {
        self.name = name
        self.metadata = metadata
        self.occurredAt = occurredAt
    }
}

public protocol CerniqTelemetrySink: Sendable {
    func record(_ event: CerniqTelemetryEvent)
}

public struct NoopCerniqTelemetrySink: CerniqTelemetrySink, Sendable {
    public init() {}

    public func record(_ event: CerniqTelemetryEvent) {}
}

public struct ClosureTelemetrySink: CerniqTelemetrySink, Sendable {
    private let handler: @Sendable (CerniqTelemetryEvent) -> Void

    public init(handler: @escaping @Sendable (CerniqTelemetryEvent) -> Void) {
        self.handler = handler
    }

    public func record(_ event: CerniqTelemetryEvent) {
        handler(event)
    }
}

public protocol WorkspaceOverviewSnapshotCaching: Sendable {
    func load() async throws -> CachedWorkspaceOverviewRecord?
    func store(_ record: CachedWorkspaceOverviewRecord) async throws
    func clear() async throws
}

public actor InMemoryWorkspaceOverviewSnapshotCache: WorkspaceOverviewSnapshotCaching {
    private var record: CachedWorkspaceOverviewRecord?

    public init(record: CachedWorkspaceOverviewRecord? = nil) {
        self.record = record
    }

    public func load() async throws -> CachedWorkspaceOverviewRecord? {
        record
    }

    public func store(_ record: CachedWorkspaceOverviewRecord) async throws {
        self.record = record
    }

    public func clear() async throws {
        record = nil
    }
}

public actor FileWorkspaceOverviewSnapshotCache: WorkspaceOverviewSnapshotCaching {
    private let fileURL: URL
    private let encoder: JSONEncoder
    private let decoder: JSONDecoder

    public init(fileURL: URL = FileWorkspaceOverviewSnapshotCache.defaultFileURL()) {
        self.fileURL = fileURL

        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        encoder.dateEncodingStrategy = .iso8601
        self.encoder = encoder

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        self.decoder = decoder
    }

    public func load() async throws -> CachedWorkspaceOverviewRecord? {
        guard FileManager.default.fileExists(atPath: fileURL.path) else {
            return nil
        }

        let data = try Data(contentsOf: fileURL)
        return try decoder.decode(CachedWorkspaceOverviewRecord.self, from: data)
    }

    public func store(_ record: CachedWorkspaceOverviewRecord) async throws {
        try ensureParentDirectory()
        let data = try encoder.encode(record)
        try data.write(to: fileURL, options: [.atomic])
    }

    public func clear() async throws {
        guard FileManager.default.fileExists(atPath: fileURL.path) else {
            return
        }

        try FileManager.default.removeItem(at: fileURL)
    }

    public static func defaultFileURL() -> URL {
        let baseDirectory = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory

        return baseDirectory
            .appendingPathComponent("io.cerniq.apple", isDirectory: true)
            .appendingPathComponent("workspace-overview-snapshot.json", isDirectory: false)
    }

    private func ensureParentDirectory() throws {
        let directoryURL = fileURL.deletingLastPathComponent()
        try FileManager.default.createDirectory(
            at: directoryURL,
            withIntermediateDirectories: true
        )
    }
}

@MainActor
public struct ContainerWorkspaceOverviewService: WorkspaceOverviewServing {
    private let container: CerniqAppSessionContainer

    public init(container: CerniqAppSessionContainer) {
        self.container = container
    }

    public func fetchOverview() async throws -> WorkspaceOverviewSnapshot {
        try await container.loadOverview().snapshot
    }
}

@MainActor
@Observable
public final class CerniqAppSessionContainer {
    public let environment: CerniqAPIEnvironment
    public let client: CerniqAPIClient
    public let authManager: AuthSessionManager

    public private(set) var session: AuthSession?
    public private(set) var overview: LoadedWorkspaceOverview?
    public private(set) var reportJobs: [PortalReportJob] = []
    public private(set) var exportManifestsByJobID: [String: [DocumentExportManifest]] = [:]

    private let fallbackSettings: PortalSettingsSnapshot?
    private let snapshotCache: any WorkspaceOverviewSnapshotCaching
    private let telemetry: any CerniqTelemetrySink

    public init(
        environment: CerniqAPIEnvironment,
        networkSession: NetworkSession = URLSession.shared,
        credentialStoreSelection: CredentialStoreSelection = .automatic,
        fallbackSettings: PortalSettingsSnapshot? = nil,
        snapshotCache: any WorkspaceOverviewSnapshotCaching = FileWorkspaceOverviewSnapshotCache(),
        telemetry: any CerniqTelemetrySink = NoopCerniqTelemetrySink()
    ) {
        self.environment = environment
        self.client = CerniqAPIClient(environment: environment, session: networkSession)
        self.authManager = AuthSessionManager(
            client: client,
            credentialStore: credentialStoreSelection.makeStore()
        )
        self.fallbackSettings = fallbackSettings
        self.snapshotCache = snapshotCache
        self.telemetry = telemetry
    }

    public func makeWorkspaceOverviewService() -> ContainerWorkspaceOverviewService {
        ContainerWorkspaceOverviewService(container: self)
    }

    @discardableResult
    public func login(email: String, password: String) async throws -> AuthSession {
        record("auth.login.started", metadata: ["environment": environment.baseURL.absoluteString])

        do {
            let nextSession = try await authManager.login(email: email, password: password)
            session = nextSession
            record("auth.login.succeeded", metadata: ["mode": nextSession.authenticationMode.rawValue])
            return nextSession
        } catch {
            record("auth.login.failed", metadata: ["error": describe(error)])
            throw error
        }
    }

    @discardableResult
    public func restoreSession() async throws -> AuthSession {
        record("auth.restore.started")

        do {
            let nextSession = try await authManager.refreshSession()
            session = nextSession
            record("auth.restore.succeeded", metadata: ["mode": nextSession.authenticationMode.rawValue])
            return nextSession
        } catch {
            record("auth.restore.failed", metadata: ["error": describe(error)])
            throw error
        }
    }

    public func logout() async throws {
        try authManager.logout()
        session = nil
        overview = nil
        reportJobs = []
        exportManifestsByJobID = [:]

        do {
            try await snapshotCache.clear()
        } catch {
            record("overview.cache.clear_failed", metadata: ["error": describe(error)])
            throw error
        }

        record("auth.logout.completed")
    }

    public func cachedOverview() async throws -> CachedWorkspaceOverviewRecord? {
        try await snapshotCache.load()
    }

    @discardableResult
    public func loadOverview() async throws -> LoadedWorkspaceOverview {
        record("overview.load.started")

        do {
            let snapshot = try await LiveWorkspaceOverviewService(
                client: client,
                authManager: authManager,
                fallbackSettings: fallbackSettings
            ).fetchOverview()

            let loadedOverview = LoadedWorkspaceOverview(
                snapshot: snapshot,
                source: .live
            )
            overview = loadedOverview
            session = authManager.session
            await persist(snapshot: snapshot)
            record("overview.load.succeeded", metadata: ["source": WorkspaceOverviewSource.live.rawValue])
            return loadedOverview
        } catch {
            record("overview.load.live_failed", metadata: ["error": describe(error)])

            if let cached = try await snapshotCache.load() {
                let cachedOverview = LoadedWorkspaceOverview(
                    snapshot: cached.snapshot,
                    source: .cached,
                    cachedAt: cached.cachedAt
                )
                overview = cachedOverview
                record(
                    "overview.load.succeeded",
                    metadata: [
                        "source": WorkspaceOverviewSource.cached.rawValue,
                        "cachedAt": ISO8601DateFormatter().string(from: cached.cachedAt),
                    ]
                )
                return cachedOverview
            }

            throw error
        }
    }

    @discardableResult
    public func loadReportJobs() async throws -> [PortalReportJob] {
        record("portal.jobs.load.started")

        do {
            let jobs = try await client.send(
                PortalAPI.reportJobs(),
                accessToken: try authManager.accessToken()
            )
            reportJobs = jobs
            record("portal.jobs.load.succeeded", metadata: ["count": "\(jobs.count)"])
            return jobs
        } catch {
            record("portal.jobs.load.failed", metadata: ["error": describe(error)])
            throw error
        }
    }

    @discardableResult
    public func loadExportManifests(for jobID: String) async throws -> [DocumentExportManifest] {
        record("portal.exports.load.started", metadata: ["jobID": jobID])

        do {
            let manifests = try await client.send(
                PortalAPI.exportManifests(jobID: jobID),
                accessToken: try authManager.accessToken()
            )
            exportManifestsByJobID[jobID] = manifests
            record(
                "portal.exports.load.succeeded",
                metadata: [
                    "jobID": jobID,
                    "count": "\(manifests.count)",
                ]
            )
            return manifests
        } catch {
            record(
                "portal.exports.load.failed",
                metadata: [
                    "jobID": jobID,
                    "error": describe(error),
                ]
            )
            throw error
        }
    }

    private func persist(snapshot: WorkspaceOverviewSnapshot) async {
        do {
            try await snapshotCache.store(
                CachedWorkspaceOverviewRecord(snapshot: snapshot, cachedAt: Date())
            )
            record("overview.cache.store_succeeded")
        } catch {
            record("overview.cache.store_failed", metadata: ["error": describe(error)])
        }
    }

    private func record(_ name: String, metadata: [String: String] = [:]) {
        telemetry.record(CerniqTelemetryEvent(name: name, metadata: metadata))
    }

    private func describe(_ error: Error) -> String {
        String(describing: error)
    }
}
