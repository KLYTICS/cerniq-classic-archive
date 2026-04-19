#if os(macOS)
import Observation
import SwiftUI

public struct CerniqMacRootView: View {
    @Bindable var appState: CerniqAppState

    public init(appState: CerniqAppState) {
        self.appState = appState
    }

    public var body: some View {
        NavigationSplitView {
            sidebar
        } detail: {
            detail
        }
        .navigationSplitViewStyle(.balanced)
    }

    private var sidebar: some View {
        List(selection: $appState.selectedDestination) {
            Section("Workspace") {
                ForEach(CerniqDestination.allCases) { destination in
                    Label(destination.title, systemImage: destination.systemImage)
                        .tag(destination)
                }
            }

            Section("Utilities") {
                Button {
                    appState.openInBrowser()
                } label: {
                    Label("Open Current Page in Browser", systemImage: "safari")
                }

                SettingsLink {
                    Label("App Settings", systemImage: "gear")
                }
            }
        }
        .listStyle(.sidebar)
        .navigationTitle("CERNIQ")
    }

    @ViewBuilder
    private var detail: some View {
        if appState.selectedDestination == .home {
            CerniqHomeView(appState: appState) { destination in
                appState.select(destination)
            }
        } else {
            CerniqBrowserScene(destination: appState.selectedDestination, appState: appState)
        }
    }
}
#endif
