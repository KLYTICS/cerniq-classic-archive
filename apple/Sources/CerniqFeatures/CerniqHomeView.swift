import Observation
import SwiftUI

public struct CerniqHomeView: View {
    @Bindable var appState: CerniqAppState
    var onOpenDestination: ((CerniqDestination) -> Void)?

    private let columns = [
        GridItem(.adaptive(minimum: 220, maximum: 320), spacing: 16),
    ]

    public init(
        appState: CerniqAppState,
        onOpenDestination: ((CerniqDestination) -> Void)? = nil
    ) {
        self.appState = appState
        self.onOpenDestination = onOpenDestination
    }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                hero
                environmentCard
                quickLaunchGrid
            }
            .padding(20)
        }
        .background(
            LinearGradient(
                colors: [
                    Color(red: 0.95, green: 0.97, blue: 0.99),
                    Color(red: 1.00, green: 0.98, blue: 0.94),
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
    }

    private var hero: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("CERNIQ on Apple platforms")
                .font(.caption.weight(.semibold))
                .textCase(.uppercase)
                .foregroundStyle(Color(red: 0.10, green: 0.31, blue: 0.56))

            Text("Board-ready ALM workflows, wrapped in native Apple navigation.")
                .font(.system(size: 34, weight: .bold, design: .rounded))

            Text("Use the launchpad for quick access, switch between production and local environments, and keep the core CERNIQ portal one tap away.")
                .font(.body)
                .foregroundStyle(.secondary)
                .frame(maxWidth: 760, alignment: .leading)
        }
    }

    private var environmentCard: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Label("Environment", systemImage: "server.rack")
                    .font(.headline)
                Spacer()
                Picker("Environment", selection: $appState.selectedEnvironment) {
                    ForEach(CerniqEnvironment.allCases) { environment in
                        Text(environment.title).tag(environment)
                    }
                }
                .pickerStyle(.segmented)
                .frame(maxWidth: 380)
            }

            Text(appState.environmentDescription)
                .font(.callout.monospaced())
                .foregroundStyle(.secondary)

            if appState.selectedEnvironment == .custom {
                TextField("https://preview.cerniq.internal", text: $appState.customBaseURL)
                    .textFieldStyle(.roundedBorder)
            }

            Toggle("Open off-domain links in the system browser", isOn: $appState.openExternalLinksInBrowser)

            Button("Reset to production defaults") {
                appState.resetEnvironment()
            }
            .buttonStyle(.bordered)
        }
        .padding(20)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
    }

    private var quickLaunchGrid: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Quick Launch")
                .font(.headline)

            LazyVGrid(columns: columns, alignment: .leading, spacing: 16) {
                ForEach(CerniqDestination.launchpadDestinations) { destination in
                    Button {
                        appState.select(destination)
                        onOpenDestination?(destination)
                    } label: {
                        VStack(alignment: .leading, spacing: 14) {
                            Image(systemName: destination.systemImage)
                                .font(.title2.weight(.semibold))
                                .foregroundStyle(Color(red: 0.10, green: 0.31, blue: 0.56))

                            Text(destination.title)
                                .font(.headline)
                                .foregroundStyle(.primary)

                            Text(destination.summary)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                                .multilineTextAlignment(.leading)

                            Spacer()

                            HStack {
                                Text("Open")
                                    .font(.caption.weight(.semibold))
                                Spacer()
                                Image(systemName: "arrow.up.right")
                                    .font(.caption.weight(.bold))
                            }
                            .foregroundStyle(Color(red: 0.10, green: 0.31, blue: 0.56))
                        }
                        .padding(18)
                        .frame(maxWidth: .infinity, minHeight: 180, alignment: .topLeading)
                        .background(
                            RoundedRectangle(cornerRadius: 22, style: .continuous)
                                .fill(Color.white.opacity(0.82))
                        )
                        .overlay {
                            RoundedRectangle(cornerRadius: 22, style: .continuous)
                                .stroke(Color.primary.opacity(0.08), lineWidth: 1)
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }
}
