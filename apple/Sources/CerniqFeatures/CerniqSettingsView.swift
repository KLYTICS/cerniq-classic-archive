import Observation
import SwiftUI

public struct CerniqSettingsView: View {
    @Bindable var appState: CerniqAppState

    public init(appState: CerniqAppState) {
        self.appState = appState
    }

    public var body: some View {
        Form {
            Section("Environment") {
                Picker("Server", selection: $appState.selectedEnvironment) {
                    ForEach(CerniqEnvironment.allCases) { environment in
                        VStack(alignment: .leading, spacing: 2) {
                            Text(environment.title)
                            Text(environment.subtitle)
                        }
                        .tag(environment)
                    }
                }

                if appState.selectedEnvironment == .custom {
                    TextField("https://preview.cerniq.internal", text: $appState.customBaseURL)
                        #if os(iOS)
                        .keyboardType(.URL)
                        .autocorrectionDisabled()
                        #endif
                }

                LabeledContent("Current Origin") {
                    Text(appState.environmentDescription)
                        .font(.callout.monospaced())
                }
            }

            Section("Browser Behavior") {
                Toggle("Open off-domain links in the system browser", isOn: $appState.openExternalLinksInBrowser)

                Button("Reload Current Destination") {
                    appState.reloadCurrentPage()
                }

                Button("Open Current Destination in Browser") {
                    appState.openInBrowser()
                }
            }

            Section("Reset") {
                Button("Reset App Defaults") {
                    appState.resetEnvironment()
                }
                .foregroundStyle(.red)
            }
        }
    }
}
