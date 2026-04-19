#if os(iOS)
import Observation
import SwiftUI

private enum CerniqIOSTab: Hashable {
    case home
    case portal
    case workspace
    case account
}

public struct CerniqIOSRootView: View {
    @Bindable var appState: CerniqAppState
    @State private var selectedTab: CerniqIOSTab = .home

    public init(appState: CerniqAppState) {
        self.appState = appState
    }

    public var body: some View {
        TabView(selection: $selectedTab) {
            NavigationStack {
                CerniqHomeView(appState: appState) { destination in
                    open(destination)
                }
                .navigationTitle("CERNIQ")
            }
            .tabItem {
                Label("Home", systemImage: "house")
            }
            .tag(CerniqIOSTab.home)

            NavigationStack {
                CerniqBrowserScene(destination: .portal, appState: appState)
                    .navigationTitle("Portal")
                    .navigationBarTitleDisplayMode(.inline)
            }
            .tabItem {
                Label("Portal", systemImage: "building.2")
            }
            .tag(CerniqIOSTab.portal)

            NavigationStack {
                CerniqBrowserScene(
                    destination: appState.selectedDestination.isNativeHome ? .reports : appState.selectedDestination,
                    appState: appState
                )
                .navigationTitle(appState.selectedDestination.isNativeHome ? "Reports" : appState.selectedDestination.title)
                .navigationBarTitleDisplayMode(.inline)
            }
            .tabItem {
                Label("Workspace", systemImage: "rectangle.split.3x1")
            }
            .tag(CerniqIOSTab.workspace)

            NavigationStack {
                CerniqSettingsView(appState: appState)
                    .navigationTitle("Account")
            }
            .tabItem {
                Label("Account", systemImage: "person.crop.circle")
            }
            .tag(CerniqIOSTab.account)
        }
    }

    private func open(_ destination: CerniqDestination) {
        appState.select(destination)

        switch destination {
        case .portal:
            selectedTab = .portal
        case .settings:
            selectedTab = .account
        case .home:
            selectedTab = .home
        default:
            selectedTab = .workspace
        }
    }
}
#endif
