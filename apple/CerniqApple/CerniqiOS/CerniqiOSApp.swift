import CerniqFeatures
import SwiftUI

@main
struct CerniqiOSApp: App {
    @State private var appState = CerniqAppState(platform: .iOS)

    var body: some Scene {
        WindowGroup {
            CerniqIOSRootView(appState: appState)
                .onOpenURL { url in
                    appState.applyIncomingURL(url)
                }
        }
    }
}
