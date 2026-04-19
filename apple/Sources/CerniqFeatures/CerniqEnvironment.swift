import CerniqAPI
import Foundation

public enum CerniqEnvironment: String, CaseIterable, Identifiable, Sendable {
    case production
    case local
    case custom

    public var id: String { rawValue }

    public var title: String {
        switch self {
        case .production:
            return "Production"
        case .local:
            return "Local"
        case .custom:
            return "Custom"
        }
    }

    public var subtitle: String {
        switch self {
        case .production:
            return "Live cerniq.io workspace"
        case .local:
            return "Local frontend on port 3001"
        case .custom:
            return "Any reachable preview or internal host"
        }
    }

    public func baseURL(customValue: String) -> URL {
        switch self {
        case .production:
            return URL(string: "https://cerniq.io")!
        case .local:
            return URL(string: "http://localhost:3001")!
        case .custom:
            let sanitized = customValue
                .trimmingCharacters(in: .whitespacesAndNewlines)
                .replacingOccurrences(of: "/+$", with: "", options: .regularExpression)

            if let url = URL(string: sanitized), url.scheme != nil {
                return url
            }

            return URL(string: "https://cerniq.io")!
        }
    }

    public func apiEnvironment(customValue: String) -> CerniqAPIEnvironment {
        CerniqAPIEnvironment(baseURL: baseURL(customValue: customValue))
    }
}
