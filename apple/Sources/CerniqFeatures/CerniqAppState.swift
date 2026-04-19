import Foundation
import Observation
import WebKit

#if os(macOS)
import AppKit
#elseif os(iOS)
import UIKit
#endif

public enum CerniqPlatform: Sendable {
    case iOS
    case macOS
}

@MainActor
@Observable
public final class CerniqAppState {
    private enum Keys {
        static let selectedEnvironment = "cerniq.apple.selected-environment"
        static let customBaseURL = "cerniq.apple.custom-base-url"
        static let selectedDestination = "cerniq.apple.selected-destination"
        static let openExternalLinks = "cerniq.apple.open-external-links"
    }

    @ObservationIgnored private let defaults: UserDefaults
    @ObservationIgnored private let cookieBridge: CerniqCookieBridge

    public let platform: CerniqPlatform

    public var selectedEnvironment: CerniqEnvironment {
        didSet { defaults.set(selectedEnvironment.rawValue, forKey: Keys.selectedEnvironment) }
    }

    public var customBaseURL: String {
        didSet { defaults.set(customBaseURL, forKey: Keys.customBaseURL) }
    }

    public var selectedDestination: CerniqDestination {
        didSet { defaults.set(selectedDestination.rawValue, forKey: Keys.selectedDestination) }
    }

    public var openExternalLinksInBrowser: Bool {
        didSet { defaults.set(openExternalLinksInBrowser, forKey: Keys.openExternalLinks) }
    }

    public var browserIsLoading = false
    public var browserTitle = "CERNIQ"
    public var browserErrorMessage: String?
    public var browserPathOverride: String?
    public var reloadToken = UUID()

    public init(
        platform: CerniqPlatform,
        defaults: UserDefaults = .standard,
        cookieStorage: HTTPCookieStorage = .shared
    ) {
        self.platform = platform
        self.defaults = defaults
        self.cookieBridge = CerniqCookieBridge(cookieStorage: cookieStorage)

        let storedEnvironment = defaults.string(forKey: Keys.selectedEnvironment)
        self.selectedEnvironment = CerniqEnvironment(rawValue: storedEnvironment ?? "") ?? .production
        self.customBaseURL = defaults.string(forKey: Keys.customBaseURL) ?? ""

        let storedDestination = defaults.string(forKey: Keys.selectedDestination)
        self.selectedDestination = CerniqDestination(rawValue: storedDestination ?? "")
            ?? (platform == .iOS ? .reports : .home)

        if defaults.object(forKey: Keys.openExternalLinks) == nil {
            self.openExternalLinksInBrowser = false
        } else {
            self.openExternalLinksInBrowser = defaults.bool(forKey: Keys.openExternalLinks)
        }
    }

    public var environmentDescription: String {
        selectedEnvironment.baseURL(customValue: customBaseURL).absoluteString
    }

    public var currentURL: URL {
        resolvedURL(for: selectedDestination.isNativeHome ? .portal : selectedDestination)
    }

    public func resolvedBaseURL() -> URL {
        selectedEnvironment.baseURL(customValue: customBaseURL)
    }

    public func resolvedURL(for destination: CerniqDestination) -> URL {
        if destination == selectedDestination,
           let browserPathOverride,
           let deepLinkedURL = URL(string: browserPathOverride, relativeTo: resolvedBaseURL())?.absoluteURL {
            return deepLinkedURL
        }

        guard let path = destination.path else {
            return resolvedBaseURL()
        }

        return resolvedBaseURL().appending(path: trimmedPath(path))
    }

    public func select(_ destination: CerniqDestination) {
        selectedDestination = destination
        browserErrorMessage = nil
        browserPathOverride = nil
    }

    public func applyIncomingURL(_ url: URL) {
        let normalizedPath = normalizedBrowserPath(from: url)
        let destination = destination(for: normalizedPath)

        selectedDestination = destination
        browserPathOverride = normalizedPath
        browserErrorMessage = nil
        browserTitle = destination.title
        reloadCurrentPage()
    }

    public func reloadCurrentPage() {
        browserErrorMessage = nil
        reloadToken = UUID()
    }

    public func resetEnvironment() {
        selectedEnvironment = .production
        customBaseURL = ""
        openExternalLinksInBrowser = false
        reloadCurrentPage()
    }

    public func openInBrowser(_ destination: CerniqDestination? = nil) {
        open(url: resolvedURL(for: destination ?? selectedDestination))
    }

    public func open(url: URL) {
        #if os(macOS)
        NSWorkspace.shared.open(url)
        #elseif os(iOS)
        UIApplication.shared.open(url)
        #endif
    }

    public func syncCookiesIntoWebView(_ cookieStore: WKHTTPCookieStore, for url: URL) async {
        await cookieBridge.syncIntoWebView(cookieStore, for: url)
    }

    public func syncCookiesFromWebView(_ cookieStore: WKHTTPCookieStore) async {
        await cookieBridge.syncFromWebView(cookieStore)
    }

    private func trimmedPath(_ path: String) -> String {
        path.hasPrefix("/") ? String(path.dropFirst()) : path
    }

    private func destination(for path: String) -> CerniqDestination {
        if path.hasPrefix("/portal/reports/") {
            return .reports
        }
        if path.hasPrefix("/portal/submit") {
            return .submitData
        }
        if path.hasPrefix("/portal/billing") {
            return .billing
        }
        if path.hasPrefix("/portal/settings") {
            return .settings
        }
        if path.hasPrefix("/portal") {
            return .portal
        }
        if path.hasPrefix("/dashboard") {
            return .dashboard
        }
        if path.hasPrefix("/login") {
            return .login
        }
        if path.hasPrefix("/status") {
            return .status
        }
        return .home
    }

    private func normalizedBrowserPath(from url: URL) -> String {
        let path = url.path.isEmpty ? "/" : url.path

        if path.hasPrefix("/api/portal/jobs/"),
           path.hasSuffix("/exports") {
            let components = path.split(separator: "/")
            if components.count >= 4 {
                let jobID = String(components[3])
                return "/portal/reports/\(jobID)"
            }
        }

        var normalized = path
        if let query = url.query, !query.isEmpty {
            normalized += "?\(query)"
        }
        return normalized
    }
}
