import AppKit
import CerniqFeatures
import SwiftUI

final class CerniqMacAppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        _ = notification
        NSApp.setActivationPolicy(.regular)
        NSApp.activate(ignoringOtherApps: true)
    }
}

@main
struct CerniqmacOSApp: App {
    @NSApplicationDelegateAdaptor(CerniqMacAppDelegate.self) private var appDelegate
    @State private var appState = CerniqAppState(platform: .macOS)

    var body: some Scene {
        WindowGroup("CERNIQ") {
            CerniqMacRootView(appState: appState)
                .frame(minWidth: 1120, minHeight: 760)
                .onOpenURL { url in
                    appState.applyIncomingURL(url)
                }
        }

        Settings {
            CerniqSettingsView(appState: appState)
                .frame(width: 540)
                .padding()
        }
    }
}
