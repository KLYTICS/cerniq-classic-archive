import Foundation

public enum CerniqDestination: String, CaseIterable, Hashable, Identifiable, Sendable {
    case home
    case portal
    case submitData
    case reports
    case dashboard
    case billing
    case settings
    case login
    case status

    public var id: String { rawValue }

    public var title: String {
        switch self {
        case .home:
            return "Launchpad"
        case .portal:
            return "Portal"
        case .submitData:
            return "Submit Data"
        case .reports:
            return "Reports"
        case .dashboard:
            return "Dashboard"
        case .billing:
            return "Billing"
        case .settings:
            return "Settings"
        case .login:
            return "Login"
        case .status:
            return "Status"
        }
    }

    public var systemImage: String {
        switch self {
        case .home:
            return "sparkles.rectangle.stack"
        case .portal:
            return "building.2.crop.circle"
        case .submitData:
            return "square.and.arrow.up"
        case .reports:
            return "doc.text.magnifyingglass"
        case .dashboard:
            return "chart.line.uptrend.xyaxis"
        case .billing:
            return "creditcard"
        case .settings:
            return "slider.horizontal.3"
        case .login:
            return "person.crop.circle.badge.checkmark"
        case .status:
            return "waveform.path.ecg"
        }
    }

    public var summary: String {
        switch self {
        case .home:
            return "Launch the native workspace and jump into the most important CERNIQ flows."
        case .portal:
            return "Open the institution portal for report history and workspace actions."
        case .submitData:
            return "Upload a balance sheet CSV and kick off the ALM pipeline."
        case .reports:
            return "Review generated ALM reports and board-ready exports."
        case .dashboard:
            return "Open the broader CERNIQ dashboard and analysis surfaces."
        case .billing:
            return "Manage plan, billing portal access, and subscription state."
        case .settings:
            return "Review workspace settings, API keys, and operator preferences."
        case .login:
            return "Authenticate with the same CERNIQ login experience used on the web."
        case .status:
            return "Check overall platform status and environment reachability."
        }
    }

    public var path: String? {
        switch self {
        case .home:
            return nil
        case .portal:
            return "/portal"
        case .submitData:
            return "/portal/submit"
        case .reports:
            return "/portal"
        case .dashboard:
            return "/dashboard"
        case .billing:
            return "/portal/billing"
        case .settings:
            return "/portal/settings"
        case .login:
            return "/login"
        case .status:
            return "/status"
        }
    }

    public var isNativeHome: Bool {
        self == .home
    }

    public var requiresAuthenticatedSession: Bool {
        switch self {
        case .portal, .submitData, .reports, .dashboard, .billing, .settings:
            return true
        case .home, .login, .status:
            return false
        }
    }

    public var isPortalFamily: Bool {
        switch self {
        case .portal, .submitData, .reports, .billing, .settings:
            return true
        default:
            return false
        }
    }

    public static var launchpadDestinations: [CerniqDestination] {
        [.portal, .submitData, .reports, .dashboard, .billing, .settings, .login, .status]
    }
}
