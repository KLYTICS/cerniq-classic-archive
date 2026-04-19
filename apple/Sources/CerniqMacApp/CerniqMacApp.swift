import CerniqAPI
import CerniqDomain
import CerniqFeatures
import SwiftUI

@main
struct CerniqMacApp: App {
    @State private var appState = CerniqAppState(platform: .macOS)
    @State private var sessionContainer = CerniqAppSessionContainer(
        environment: CerniqAPIEnvironment(baseURL: URL(string: "https://cerniq.io")!)
    )

    var body: some Scene {
        WindowGroup("CERNIQ Apple") {
            CerniqMacWorkspaceView(
                appState: appState,
                sessionContainer: sessionContainer
            )
            .frame(minWidth: 1280, minHeight: 760)
            .onChange(of: appState.selectedEnvironment) { _, _ in
                rebuildContainer()
            }
            .onChange(of: appState.customBaseURL) { _, _ in
                if appState.selectedEnvironment == .custom {
                    rebuildContainer()
                }
            }
        }

        Settings {
            CerniqSettingsView(appState: appState)
                .frame(width: 420)
                .padding(24)
        }
    }

    private func rebuildContainer() {
        sessionContainer = CerniqAppSessionContainer(
            environment: appState.selectedEnvironment.apiEnvironment(customValue: appState.customBaseURL)
        )
    }
}

private struct CerniqMacWorkspaceView: View {
    @Bindable var appState: CerniqAppState
    @Bindable var sessionContainer: CerniqAppSessionContainer

    @State private var email = ""
    @State private var password = ""
    @State private var isAuthenticating = false
    @State private var authErrorMessage: String?

    var body: some View {
        HSplitView {
            nativePanel
                .frame(minWidth: 360, idealWidth: 420, maxWidth: 460)

            CerniqMacRootView(appState: appState)
        }
        .task {
            await restoreIfPossible()
        }
    }

    @ViewBuilder
    private var nativePanel: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                header

                if let session = sessionContainer.session {
                    sessionSummary(session)
                    overviewPanel
                    reportJobsPanel
                    actionButtons
                } else {
                    loginPanel
                }
            }
            .padding(24)
        }
        .background(
            LinearGradient(
                colors: [
                    Color(red: 0.96, green: 0.97, blue: 0.99),
                    Color(red: 0.99, green: 0.97, blue: 0.94),
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("CERNIQ Native Console")
                .font(.system(.title, design: .rounded, weight: .bold))

            Text("Native auth, cached overview, and report readiness live beside the embedded portal.")
                .foregroundStyle(.secondary)

            Label(appState.environmentDescription, systemImage: "network")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    private var loginPanel: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Sign in")
                .font(.headline)

            TextField("ana@coop.pr", text: $email)
                .textFieldStyle(.roundedBorder)
                .accessibilityLabel("Email")

            SecureField("Password", text: $password)
                .textFieldStyle(.roundedBorder)
                .accessibilityLabel("Password")

            if let authErrorMessage {
                Label(authErrorMessage, systemImage: "exclamationmark.triangle")
                    .font(.caption)
                    .foregroundStyle(.orange)
            }

            Button {
                Task { await login() }
            } label: {
                if isAuthenticating {
                    ProgressView()
                } else {
                    Label("Sign In", systemImage: "person.crop.circle.badge.checkmark")
                }
            }
            .buttonStyle(.borderedProminent)
            .disabled(isAuthenticating || email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || password.isEmpty)

            Button("Open Web Login") {
                appState.select(.login)
            }
            .buttonStyle(.bordered)
        }
        .padding(20)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
    }

    private func sessionSummary(_ session: AuthSession) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(session.user.workspaceName ?? "CERNIQ Workspace")
                .font(.headline)

            Label(session.user.email, systemImage: "person.crop.circle")
            Label(session.authenticationMode.rawValue, systemImage: "lock.shield")

            if let cachedAt = sessionContainer.overview?.cachedAt {
                Label("Cached \(cachedAt.formatted(date: .abbreviated, time: .shortened))", systemImage: "externaldrive.badge.clock")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
    }

    @ViewBuilder
    private var overviewPanel: some View {
        if let overview = sessionContainer.overview {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text("Workspace Overview")
                        .font(.headline)
                    Spacer()
                    Label(overview.source.rawValue.capitalized, systemImage: overview.source == .live ? "dot.radiowaves.left.and.right" : "tray.full")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                ForEach(overview.snapshot.highlights) { metric in
                    HStack {
                        Text(metric.title)
                        Spacer()
                        Text(metric.value)
                            .fontWeight(.semibold)
                    }
                }
            }
            .padding(20)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        } else {
            ContentUnavailableView("Overview unavailable", systemImage: "chart.line.uptrend.xyaxis")
        }
    }

    private var reportJobsPanel: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Report Jobs")
                    .font(.headline)
                Spacer()
                Text("\(sessionContainer.reportJobs.count)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            if sessionContainer.reportJobs.isEmpty {
                Text("No report jobs loaded yet.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else {
                ForEach(sessionContainer.reportJobs.prefix(4)) { job in
                    Button {
                        appState.applyIncomingURL(
                            appState.resolvedBaseURL().appending(path: "portal/reports/\(job.id)")
                        )
                    } label: {
                        VStack(alignment: .leading, spacing: 6) {
                            Text(job.institutionName)
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(.primary)
                            HStack {
                                Text(job.status)
                                Spacer()
                                Text(job.exportSummary?.status.rawValue.replacingOccurrences(of: "_", with: " ").capitalized ?? "Unknown")
                            }
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        }
                        .padding(12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(.white.opacity(0.78), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
    }

    private var actionButtons: some View {
        HStack {
            Button("Refresh Native Data") {
                Task { await refreshNativeData() }
            }
            .buttonStyle(.borderedProminent)

            Button("Open Portal") {
                appState.select(.portal)
            }
            .buttonStyle(.bordered)

            Button("Sign Out") {
                Task { await logout() }
            }
            .buttonStyle(.bordered)
        }
    }

    private func restoreIfPossible() async {
        guard sessionContainer.session == nil else { return }

        do {
            _ = try await sessionContainer.restoreSession()
            await refreshNativeData()
        } catch {
            authErrorMessage = nil
        }
    }

    private func login() async {
        isAuthenticating = true
        authErrorMessage = nil

        do {
            _ = try await sessionContainer.login(email: email, password: password)
            await refreshNativeData()
        } catch {
            authErrorMessage = String(describing: error)
        }

        isAuthenticating = false
    }

    private func refreshNativeData() async {
        do {
            _ = try await sessionContainer.loadOverview()
            _ = try await sessionContainer.loadReportJobs()
        } catch {
            authErrorMessage = String(describing: error)
        }
    }

    private func logout() async {
        do {
            try await sessionContainer.logout()
            authErrorMessage = nil
            password = ""
        } catch {
            authErrorMessage = String(describing: error)
        }
    }
}
