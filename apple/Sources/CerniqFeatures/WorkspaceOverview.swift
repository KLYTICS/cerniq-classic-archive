import CerniqAPI
import CerniqAuth
import CerniqDomain
import Foundation
import Observation
import SwiftUI

@MainActor
public protocol WorkspaceOverviewServing {
    func fetchOverview() async throws -> WorkspaceOverviewSnapshot
}

public struct PreviewWorkspaceOverviewService: WorkspaceOverviewServing, Sendable {
    private let snapshot: WorkspaceOverviewSnapshot

    public init(snapshot: WorkspaceOverviewSnapshot = .sample) {
        self.snapshot = snapshot
    }

    public func fetchOverview() async throws -> WorkspaceOverviewSnapshot {
        snapshot
    }
}

public struct LiveWorkspaceOverviewService: WorkspaceOverviewServing, Sendable {
    private let client: CerniqAPIClient
    private let authManager: AuthSessionManager
    private let fallbackSettings: PortalSettingsSnapshot?

    public init(
        client: CerniqAPIClient,
        authManager: AuthSessionManager,
        fallbackSettings: PortalSettingsSnapshot? = nil
    ) {
        self.client = client
        self.authManager = authManager
        self.fallbackSettings = fallbackSettings
    }

    public func fetchOverview() async throws -> WorkspaceOverviewSnapshot {
        let token = try authManager.accessToken()
        let user = try await authManager.loadProfile()
        let institutionsPage = try await client.send(ALMAPI.listInstitutions(), accessToken: token)
        let institutions = institutionsPage.items

        let settings = (try? await client.send(PortalAPI.settings(), accessToken: token))
            ?? fallbackSettings
            ?? PortalSettingsSnapshot.fallback(user: user, institutions: institutions)

        let summary: ALMSummary?
        if let institutionID = institutions.first?.id {
            summary = try? await client.send(
                ALMAPI.summary(
                    institutionID: institutionID,
                    routeStyle: client.environment.almRouteStyle
                ),
                accessToken: token
            )
        } else {
            summary = nil
        }

        return WorkspaceOverviewSnapshot(
            user: user,
            settings: settings,
            institutions: institutions,
            summary: summary,
            highlights: buildHighlights(settings: settings, institutions: institutions, summary: summary)
        )
    }

    private func buildHighlights(
        settings: PortalSettingsSnapshot,
        institutions: [InstitutionSummary],
        summary: ALMSummary?
    ) -> [OverviewMetric] {
        let durationStatus: MetricStatus
        if let gap = summary?.durationGap {
            durationStatus = gap >= 2.0 ? .critical : .monitor
        } else {
            durationStatus = .monitor
        }

        let lcrStatus: MetricStatus
        if let lcr = summary?.liquidityCoverageRatio {
            lcrStatus = lcr >= 100 ? .healthy : .critical
        } else {
            lcrStatus = .monitor
        }

        return [
            OverviewMetric(
                id: "plan",
                title: "Plan",
                value: settings.subscriptionTier.capitalized,
                status: .healthy
            ),
            OverviewMetric(
                id: "institutions",
                title: "Institutions",
                value: "\(institutions.count)",
                status: institutions.isEmpty ? .critical : .healthy
            ),
            OverviewMetric(
                id: "duration-gap",
                title: "Duration Gap",
                value: summary?.durationGap.map { String(format: "%.2f", $0) } ?? "N/A",
                status: durationStatus
            ),
            OverviewMetric(
                id: "liquidity",
                title: "Liquidity Coverage",
                value: summary?.liquidityCoverageRatio.map { String(format: "%.1f%%", $0) } ?? "N/A",
                status: lcrStatus
            ),
        ]
    }
}

@MainActor
@Observable
public final class WorkspaceOverviewViewModel {
    public private(set) var snapshot: WorkspaceOverviewSnapshot?
    public private(set) var isLoading = false
    public private(set) var errorMessage: String?

    private let service: WorkspaceOverviewServing

    public init(service: WorkspaceOverviewServing) {
        self.service = service
    }

    public func load() async {
        guard !isLoading else { return }

        isLoading = true
        errorMessage = nil

        do {
            snapshot = try await service.fetchOverview()
        } catch {
            errorMessage = String(describing: error)
        }

        isLoading = false
    }
}

public struct WorkspaceOverviewView: View {
    private let viewModel: WorkspaceOverviewViewModel

    public init(viewModel: WorkspaceOverviewViewModel) {
        self.viewModel = viewModel
    }

    public var body: some View {
        Group {
            if let snapshot = viewModel.snapshot {
                ScrollView {
                    VStack(alignment: .leading, spacing: 24) {
                        header(snapshot: snapshot)
                        metrics(snapshot.highlights)
                        institutions(snapshot.institutions)
                    }
                    .padding(24)
                }
            } else if viewModel.isLoading {
                ContentUnavailableView("Loading CERNIQ", systemImage: "chart.line.uptrend.xyaxis")
            } else if let errorMessage = viewModel.errorMessage {
                ContentUnavailableView(
                    "Unable to load workspace",
                    systemImage: "exclamationmark.triangle",
                    description: Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                )
            } else {
                ContentUnavailableView("CERNIQ Apple", systemImage: "building.columns")
            }
        }
        .navigationTitle("CERNIQ Apple")
        .task {
            if viewModel.snapshot == nil {
                await viewModel.load()
            }
        }
    }

    private func header(snapshot: WorkspaceOverviewSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(snapshot.settings.workspaceName)
                .font(.largeTitle)
                .fontWeight(.semibold)

            Text("Institutional ALM reporting for \(snapshot.settings.institutionName ?? "your workspace")")
                .foregroundStyle(.secondary)

            HStack(spacing: 12) {
                Label(snapshot.settings.subscriptionTier.capitalized, systemImage: "checkmark.seal")
                Label("\(snapshot.institutions.count) institutions", systemImage: "building.2")
                if let rating = snapshot.summary?.riskRating {
                    Label(rating.capitalized, systemImage: "waveform.path.ecg")
                }
            }
            .font(.subheadline)
            .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(20)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
    }

    private func metrics(_ metrics: [OverviewMetric]) -> some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 180), spacing: 16)], spacing: 16) {
            ForEach(metrics) { metric in
                VStack(alignment: .leading, spacing: 10) {
                    Text(metric.title)
                        .font(.headline)
                    Text(metric.value)
                        .font(.title2)
                        .fontWeight(.semibold)
                    Text(metric.status.rawValue.capitalized)
                        .font(.caption)
                        .foregroundStyle(statusColor(metric.status))
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(18)
                .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            }
        }
    }

    private func institutions(_ institutions: [InstitutionSummary]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Institutions")
                .font(.title3)
                .fontWeight(.semibold)

            ForEach(institutions) { institution in
                VStack(alignment: .leading, spacing: 6) {
                    Text(institution.name)
                        .font(.headline)

                    HStack(spacing: 12) {
                        Text(institution.type.capitalized)
                        if let reportingDate = institution.reportingDate {
                            Text(reportingDate)
                        }
                        if let totalAssets = institution.totalAssets {
                            Text(currency(totalAssets))
                        }
                    }
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(16)
                .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            }
        }
    }

    private func statusColor(_ status: MetricStatus) -> Color {
        switch status {
        case .healthy:
            return .green
        case .monitor:
            return .orange
        case .critical:
            return .red
        }
    }

    private func currency(_ value: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "USD"
        formatter.maximumFractionDigits = 0
        return formatter.string(from: NSNumber(value: value)) ?? "$0"
    }
}
