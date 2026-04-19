import Observation
import SwiftUI

public struct CerniqBrowserScene: View {
    let destination: CerniqDestination

    @Bindable var appState: CerniqAppState

    public init(destination: CerniqDestination, appState: CerniqAppState) {
        self.destination = destination
        self.appState = appState
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            header
            CerniqWebView(url: appState.resolvedURL(for: destination), appState: appState)
                .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: 20, style: .continuous)
                        .stroke(Color.primary.opacity(0.08), lineWidth: 1)
                }
        }
        .padding(20)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(
            LinearGradient(
                colors: [
                    Color(red: 0.95, green: 0.97, blue: 0.99),
                    Color(red: 0.99, green: 0.97, blue: 0.93),
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
    }

    private var header: some View {
        HStack(alignment: .top, spacing: 16) {
            VStack(alignment: .leading, spacing: 6) {
                Text(destination.title)
                    .font(.system(.largeTitle, design: .rounded, weight: .bold))

                Text(destination.summary)
                    .font(.callout)
                    .foregroundStyle(.secondary)

                Label(appState.environmentDescription, systemImage: "network")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                if let browserErrorMessage = appState.browserErrorMessage {
                    Label(browserErrorMessage, systemImage: "exclamationmark.triangle")
                        .font(.caption)
                        .foregroundStyle(.orange)
                }
            }

            Spacer()

            HStack(spacing: 10) {
                Button {
                    appState.reloadCurrentPage()
                } label: {
                    Label("Reload", systemImage: "arrow.clockwise")
                }
                .buttonStyle(.bordered)

                Button {
                    appState.openInBrowser(destination)
                } label: {
                    Label("Open in Browser", systemImage: "safari")
                }
                .buttonStyle(.borderedProminent)
                .tint(Color(red: 0.10, green: 0.31, blue: 0.56))
            }
        }
    }
}
