// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "CerniqApple",
    platforms: [
        .iOS(.v17),
        .macOS(.v14),
    ],
    products: [
        .library(name: "CerniqDomain", targets: ["CerniqDomain"]),
        .library(name: "CerniqAPI", targets: ["CerniqAPI"]),
        .library(name: "CerniqAuth", targets: ["CerniqAuth"]),
        .library(name: "CerniqFeatures", targets: ["CerniqFeatures"]),
        .executable(name: "CerniqMacApp", targets: ["CerniqMacApp"]),
        .executable(name: "CerniqContractsCheck", targets: ["CerniqContractsCheck"]),
    ],
    targets: [
        .target(
            name: "CerniqDomain"
        ),
        .target(
            name: "CerniqAPI",
            dependencies: ["CerniqDomain"]
        ),
        .target(
            name: "CerniqAuth",
            dependencies: ["CerniqAPI", "CerniqDomain"]
        ),
        .target(
            name: "CerniqFeatures",
            dependencies: ["CerniqAPI", "CerniqAuth", "CerniqDomain"]
        ),
        .executableTarget(
            name: "CerniqMacApp",
            dependencies: ["CerniqFeatures"]
        ),
        .executableTarget(
            name: "CerniqContractsCheck",
            dependencies: ["CerniqAPI", "CerniqAuth", "CerniqFeatures", "CerniqDomain"]
        ),
        .testTarget(
            name: "CerniqDomainTests",
            dependencies: ["CerniqDomain"]
        ),
        .testTarget(
            name: "CerniqAPITests",
            dependencies: ["CerniqAPI", "CerniqDomain"]
        ),
        .testTarget(
            name: "CerniqAuthTests",
            dependencies: ["CerniqAuth", "CerniqAPI", "CerniqDomain"]
        ),
        .testTarget(
            name: "CerniqFeaturesTests",
            dependencies: ["CerniqFeatures", "CerniqAuth", "CerniqAPI", "CerniqDomain"]
        ),
    ],
    swiftLanguageModes: [.v6]
)
