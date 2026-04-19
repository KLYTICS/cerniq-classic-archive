import Foundation

public struct AuthUser: Codable, Equatable, Identifiable, Sendable {
    public let id: String
    public let email: String
    public let name: String?
    public let workspaceID: String?
    public let workspaceName: String?
    public let subscriptionTier: String?

    public init(
        id: String,
        email: String,
        name: String? = nil,
        workspaceID: String? = nil,
        workspaceName: String? = nil,
        subscriptionTier: String? = nil
    ) {
        self.id = id
        self.email = email
        self.name = name
        self.workspaceID = workspaceID
        self.workspaceName = workspaceName
        self.subscriptionTier = subscriptionTier
    }

    enum CodingKeys: String, CodingKey {
        case id
        case email
        case name
        case workspaceID = "workspaceId"
        case workspaceName
        case subscriptionTier
    }
}

public enum AuthenticationMode: String, Codable, Equatable, Sendable {
    case cookieBacked
    case tokenBacked
}

public struct AuthSession: Codable, Equatable, Sendable {
    public let user: AuthUser
    public let accessToken: String?
    public let refreshToken: String?
    public let authenticationMode: AuthenticationMode

    public init(
        user: AuthUser,
        accessToken: String?,
        refreshToken: String?,
        authenticationMode: AuthenticationMode
    ) {
        self.user = user
        self.accessToken = accessToken
        self.refreshToken = refreshToken
        self.authenticationMode = authenticationMode
    }
}

public struct PortalSettingsSnapshot: Codable, Equatable, Sendable {
    public let workspaceName: String
    public let subscriptionTier: String
    public let institutionName: String?
    public let institutionType: String?

    public init(
        workspaceName: String,
        subscriptionTier: String,
        institutionName: String? = nil,
        institutionType: String? = nil
    ) {
        self.workspaceName = workspaceName
        self.subscriptionTier = subscriptionTier
        self.institutionName = institutionName
        self.institutionType = institutionType
    }

    public static func fallback(user: AuthUser, institutions: [InstitutionSummary]) -> PortalSettingsSnapshot {
        PortalSettingsSnapshot(
            workspaceName: user.workspaceName ?? "CERNIQ Workspace",
            subscriptionTier: user.subscriptionTier ?? "unknown",
            institutionName: institutions.first?.name,
            institutionType: institutions.first?.type
        )
    }
}

public struct InstitutionSummary: Codable, Equatable, Identifiable, Sendable {
    public let id: String
    public let name: String
    public let type: String
    public let totalAssets: Double?
    public let reportingDate: String?

    public init(
        id: String,
        name: String,
        type: String,
        totalAssets: Double? = nil,
        reportingDate: String? = nil
    ) {
        self.id = id
        self.name = name
        self.type = type
        self.totalAssets = totalAssets
        self.reportingDate = reportingDate
    }
}

public struct ALMSummary: Codable, Equatable, Sendable {
    public let institutionID: String
    public let durationGap: Double?
    public let riskRating: String?
    public let liquidityCoverageRatio: Double?
    public let netInterestMargin: Double?

    public init(
        institutionID: String,
        durationGap: Double? = nil,
        riskRating: String? = nil,
        liquidityCoverageRatio: Double? = nil,
        netInterestMargin: Double? = nil
    ) {
        self.institutionID = institutionID
        self.durationGap = durationGap
        self.riskRating = riskRating
        self.liquidityCoverageRatio = liquidityCoverageRatio
        self.netInterestMargin = netInterestMargin
    }

    enum CodingKeys: String, CodingKey {
        case institutionID = "institutionId"
        case durationGap
        case riskRating
        case liquidityCoverageRatio
        case netInterestMargin
    }
}

public enum MetricStatus: String, Codable, Equatable, Sendable {
    case healthy
    case monitor
    case critical
}

public struct OverviewMetric: Codable, Equatable, Identifiable, Sendable {
    public let id: String
    public let title: String
    public let value: String
    public let status: MetricStatus

    public init(id: String, title: String, value: String, status: MetricStatus) {
        self.id = id
        self.title = title
        self.value = value
        self.status = status
    }
}

public struct WorkspaceOverviewSnapshot: Codable, Equatable, Sendable {
    public let user: AuthUser
    public let settings: PortalSettingsSnapshot
    public let institutions: [InstitutionSummary]
    public let summary: ALMSummary?
    public let highlights: [OverviewMetric]

    public init(
        user: AuthUser,
        settings: PortalSettingsSnapshot,
        institutions: [InstitutionSummary],
        summary: ALMSummary?,
        highlights: [OverviewMetric]
    ) {
        self.user = user
        self.settings = settings
        self.institutions = institutions
        self.summary = summary
        self.highlights = highlights
    }
}

public enum WorkspaceOverviewSource: String, Codable, Equatable, Sendable {
    case live
    case cached
}

public struct CachedWorkspaceOverviewRecord: Codable, Equatable, Sendable {
    public let snapshot: WorkspaceOverviewSnapshot
    public let cachedAt: Date

    public init(snapshot: WorkspaceOverviewSnapshot, cachedAt: Date) {
        self.snapshot = snapshot
        self.cachedAt = cachedAt
    }
}

public struct LoadedWorkspaceOverview: Equatable, Sendable {
    public let snapshot: WorkspaceOverviewSnapshot
    public let source: WorkspaceOverviewSource
    public let cachedAt: Date?

    public init(
        snapshot: WorkspaceOverviewSnapshot,
        source: WorkspaceOverviewSource,
        cachedAt: Date? = nil
    ) {
        self.snapshot = snapshot
        self.source = source
        self.cachedAt = cachedAt
    }
}

public enum DocumentLanguage: String, Codable, CaseIterable, Equatable, Sendable {
    case en
    case es
}

public enum DocumentExportKind: String, Codable, Equatable, Sendable {
    case almReport = "alm_report"
    case sampleReport = "sample_report"
    case alcoPack = "alco_pack"
    case previewReport = "preview_report"
}

public enum DocumentExportAudience: String, Codable, Equatable, Sendable {
    case `internal`
    case external
    case sample
}

public enum DocumentExportStatus: String, Codable, Equatable, Sendable {
    case ready
    case processing
    case failed
    case unavailable
}

public struct DocumentExportManifest: Codable, Equatable, Identifiable, Sendable {
    public let id: String
    public let kind: DocumentExportKind
    public let language: DocumentLanguage
    public let audience: DocumentExportAudience
    public let filename: String
    public let mimeType: String
    public let status: DocumentExportStatus
    public let downloadURL: String?
    public let generatedAt: String?
    public let expiresAt: String?
    public let watermark: String?
    public let sourceInstitutionID: String?
    public let sourceJobID: String?

    public init(
        id: String,
        kind: DocumentExportKind,
        language: DocumentLanguage,
        audience: DocumentExportAudience,
        filename: String,
        mimeType: String,
        status: DocumentExportStatus,
        downloadURL: String?,
        generatedAt: String? = nil,
        expiresAt: String? = nil,
        watermark: String? = nil,
        sourceInstitutionID: String? = nil,
        sourceJobID: String? = nil
    ) {
        self.id = id
        self.kind = kind
        self.language = language
        self.audience = audience
        self.filename = filename
        self.mimeType = mimeType
        self.status = status
        self.downloadURL = downloadURL
        self.generatedAt = generatedAt
        self.expiresAt = expiresAt
        self.watermark = watermark
        self.sourceInstitutionID = sourceInstitutionID
        self.sourceJobID = sourceJobID
    }

    enum CodingKeys: String, CodingKey {
        case id
        case kind
        case language
        case audience
        case filename
        case mimeType
        case status
        case downloadURL = "downloadUrl"
        case generatedAt
        case expiresAt
        case watermark
        case sourceInstitutionID = "sourceInstitutionId"
        case sourceJobID = "sourceJobId"
    }
}

public enum PortalJobExportStatus: String, Codable, Equatable, Sendable {
    case notApplicable = "not_applicable"
    case ready
    case partial
    case missing
}

public struct PortalJobExportSummary: Codable, Equatable, Sendable {
    public let manifestPath: String
    public let status: PortalJobExportStatus
    public let readyCount: Int
    public let totalCount: Int
    public let readyReportLanguages: [DocumentLanguage]
    public let missingReportLanguages: [DocumentLanguage]
    public let readyBoardPackLanguages: [DocumentLanguage]
    public let missingBoardPackLanguages: [DocumentLanguage]

    public init(
        manifestPath: String,
        status: PortalJobExportStatus,
        readyCount: Int,
        totalCount: Int,
        readyReportLanguages: [DocumentLanguage],
        missingReportLanguages: [DocumentLanguage],
        readyBoardPackLanguages: [DocumentLanguage],
        missingBoardPackLanguages: [DocumentLanguage]
    ) {
        self.manifestPath = manifestPath
        self.status = status
        self.readyCount = readyCount
        self.totalCount = totalCount
        self.readyReportLanguages = readyReportLanguages
        self.missingReportLanguages = missingReportLanguages
        self.readyBoardPackLanguages = readyBoardPackLanguages
        self.missingBoardPackLanguages = missingBoardPackLanguages
    }
}

public struct PortalReportJob: Codable, Equatable, Identifiable, Sendable {
    public let id: String
    public let institutionID: String?
    public let institutionName: String
    public let status: String
    public let analysisPeriod: String?
    public let previousJobID: String?
    public let submittedAt: String?
    public let processingStartedAt: String?
    public let completedAt: String?
    public let createdAt: String
    public let reportURL: String?
    public let reportURLEn: String?
    public let reportLanguage: String
    public let errorMessage: String?
    public let userID: String
    public let triggeredBy: String
    public let exportSummary: PortalJobExportSummary?

    public init(
        id: String,
        institutionID: String? = nil,
        institutionName: String,
        status: String,
        analysisPeriod: String? = nil,
        previousJobID: String? = nil,
        submittedAt: String? = nil,
        processingStartedAt: String? = nil,
        completedAt: String? = nil,
        createdAt: String,
        reportURL: String? = nil,
        reportURLEn: String? = nil,
        reportLanguage: String,
        errorMessage: String? = nil,
        userID: String,
        triggeredBy: String,
        exportSummary: PortalJobExportSummary? = nil
    ) {
        self.id = id
        self.institutionID = institutionID
        self.institutionName = institutionName
        self.status = status
        self.analysisPeriod = analysisPeriod
        self.previousJobID = previousJobID
        self.submittedAt = submittedAt
        self.processingStartedAt = processingStartedAt
        self.completedAt = completedAt
        self.createdAt = createdAt
        self.reportURL = reportURL
        self.reportURLEn = reportURLEn
        self.reportLanguage = reportLanguage
        self.errorMessage = errorMessage
        self.userID = userID
        self.triggeredBy = triggeredBy
        self.exportSummary = exportSummary
    }

    enum CodingKeys: String, CodingKey {
        case id
        case institutionID = "institutionId"
        case institutionName
        case status
        case analysisPeriod
        case previousJobID = "previousJobId"
        case submittedAt
        case processingStartedAt
        case completedAt
        case createdAt
        case reportURL = "reportUrl"
        case reportURLEn = "reportUrlEn"
        case reportLanguage = "reportLang"
        case errorMessage
        case userID = "userId"
        case triggeredBy
        case exportSummary
    }
}

public extension WorkspaceOverviewSnapshot {
    static let sample = WorkspaceOverviewSnapshot(
        user: AuthUser(
            id: "user_123",
            email: "ana@coop.pr",
            name: "Ana Rivera",
            workspaceID: "ws_123",
            workspaceName: "CoopAhorro Workspace",
            subscriptionTier: "annual"
        ),
        settings: PortalSettingsSnapshot(
            workspaceName: "CoopAhorro Workspace",
            subscriptionTier: "annual",
            institutionName: "CoopAhorro San Juan",
            institutionType: "cooperativa"
        ),
        institutions: [
            InstitutionSummary(
                id: "inst_123",
                name: "CoopAhorro San Juan",
                type: "cooperativa",
                totalAssets: 250_000_000,
                reportingDate: "Q1-2026"
            ),
            InstitutionSummary(
                id: "inst_456",
                name: "CoopAhorro Ponce",
                type: "cooperativa",
                totalAssets: 180_000_000,
                reportingDate: "Q1-2026"
            ),
        ],
        summary: ALMSummary(
            institutionID: "inst_123",
            durationGap: 1.8,
            riskRating: "asset-sensitive",
            liquidityCoverageRatio: 115.5,
            netInterestMargin: 3.15
        ),
        highlights: [
            OverviewMetric(id: "plan", title: "Plan", value: "Annual", status: .healthy),
            OverviewMetric(id: "lcr", title: "Liquidity Coverage", value: "115.5%", status: .healthy),
            OverviewMetric(id: "gap", title: "Duration Gap", value: "1.8", status: .monitor),
            OverviewMetric(id: "nim", title: "Net Interest Margin", value: "3.15%", status: .healthy),
        ]
    )
}
