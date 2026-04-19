import Observation
import SwiftUI
import WebKit

#if os(macOS)
import AppKit
#elseif os(iOS)
import UIKit
#endif

@MainActor
final class CerniqCookieBridge {
    private let cookieStorage: HTTPCookieStorage

    init(cookieStorage: HTTPCookieStorage) {
        self.cookieStorage = cookieStorage
    }

    func syncIntoWebView(_ cookieStore: WKHTTPCookieStore, for url: URL) async {
        let cookies = cookieStorage.cookies(for: url) ?? cookieStorage.cookies ?? []
        for cookie in cookies {
            await withCheckedContinuation { continuation in
                cookieStore.setCookie(cookie) {
                    continuation.resume()
                }
            }
        }
    }

    func syncFromWebView(_ cookieStore: WKHTTPCookieStore) async {
        let cookies = await withCheckedContinuation { continuation in
            cookieStore.getAllCookies { cookies in
                continuation.resume(returning: cookies)
            }
        }

        for cookie in cookies {
            cookieStorage.setCookie(cookie)
        }
    }
}

public struct CerniqWebView: View {
    let url: URL

    @Bindable var appState: CerniqAppState

    public init(url: URL, appState: CerniqAppState) {
        self.url = url
        self.appState = appState
    }

    public var body: some View {
        PlatformWebView(url: url, appState: appState)
            .overlay(alignment: .topTrailing) {
                if appState.browserIsLoading {
                    ProgressView()
                        .padding(12)
                }
            }
    }
}

@MainActor
private final class CerniqNavigationDelegate: NSObject, WKNavigationDelegate {
    private let appState: CerniqAppState

    init(appState: CerniqAppState) {
        self.appState = appState
    }

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        Task { @MainActor in
            appState.browserIsLoading = true
            appState.browserErrorMessage = nil
        }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        Task {
            await appState.syncCookiesFromWebView(webView.configuration.websiteDataStore.httpCookieStore)

            await MainActor.run {
                appState.browserIsLoading = false
                appState.browserTitle = webView.title ?? "CERNIQ"
                appState.browserErrorMessage = nil
            }
        }
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        Task { @MainActor in
            appState.browserIsLoading = false
            appState.browserErrorMessage = error.localizedDescription
        }
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        Task { @MainActor in
            appState.browserIsLoading = false
            appState.browserErrorMessage = error.localizedDescription
        }
    }

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping @MainActor @Sendable (WKNavigationActionPolicy) -> Void
    ) {
        guard
            appState.openExternalLinksInBrowser,
            navigationAction.navigationType == .linkActivated,
            let targetURL = navigationAction.request.url
        else {
            decisionHandler(.allow)
            return
        }

        let currentHost = appState.resolvedBaseURL().host
        if targetURL.host != currentHost {
            appState.open(url: targetURL)
            decisionHandler(.cancel)
            return
        }

        decisionHandler(.allow)
    }
}

#if os(iOS)
private struct PlatformWebView: UIViewRepresentable {
    let url: URL
    @Bindable var appState: CerniqAppState

    func makeCoordinator() -> Coordinator {
        Coordinator(appState: appState)
    }

    func makeUIView(context: Context) -> WKWebView {
        let webView = configuredWebView()
        webView.navigationDelegate = context.coordinator.navigationDelegate
        context.coordinator.load(url, into: webView, appState: appState)
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        if context.coordinator.lastURL != url || context.coordinator.lastReloadToken != appState.reloadToken {
            context.coordinator.load(url, into: webView, appState: appState)
        }
    }

    private func configuredWebView() -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.allowsBackForwardNavigationGestures = true
        return webView
    }

    final class Coordinator {
        let navigationDelegate: CerniqNavigationDelegate
        var lastURL: URL?
        var lastReloadToken = UUID()

        @MainActor
        init(appState: CerniqAppState) {
            self.navigationDelegate = CerniqNavigationDelegate(appState: appState)
        }

        @MainActor
        func load(_ url: URL, into webView: WKWebView, appState: CerniqAppState) {
            lastURL = url
            lastReloadToken = appState.reloadToken

            Task {
                await appState.syncCookiesIntoWebView(webView.configuration.websiteDataStore.httpCookieStore, for: url)
                _ = await MainActor.run {
                    webView.load(URLRequest(url: url))
                }
            }
        }
    }
}
#elseif os(macOS)
private struct PlatformWebView: NSViewRepresentable {
    let url: URL
    @Bindable var appState: CerniqAppState

    func makeCoordinator() -> Coordinator {
        Coordinator(appState: appState)
    }

    func makeNSView(context: Context) -> WKWebView {
        let webView = configuredWebView()
        webView.navigationDelegate = context.coordinator.navigationDelegate
        context.coordinator.load(url, into: webView, appState: appState)
        return webView
    }

    func updateNSView(_ webView: WKWebView, context: Context) {
        if context.coordinator.lastURL != url || context.coordinator.lastReloadToken != appState.reloadToken {
            context.coordinator.load(url, into: webView, appState: appState)
        }
    }

    private func configuredWebView() -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        return WKWebView(frame: .zero, configuration: configuration)
    }

    final class Coordinator {
        let navigationDelegate: CerniqNavigationDelegate
        var lastURL: URL?
        var lastReloadToken = UUID()

        @MainActor
        init(appState: CerniqAppState) {
            self.navigationDelegate = CerniqNavigationDelegate(appState: appState)
        }

        @MainActor
        func load(_ url: URL, into webView: WKWebView, appState: CerniqAppState) {
            lastURL = url
            lastReloadToken = appState.reloadToken

            Task {
                await appState.syncCookiesIntoWebView(webView.configuration.websiteDataStore.httpCookieStore, for: url)
                _ = await MainActor.run {
                    webView.load(URLRequest(url: url))
                }
            }
        }
    }
}
#endif
