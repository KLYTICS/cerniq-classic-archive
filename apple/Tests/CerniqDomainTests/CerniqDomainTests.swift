import XCTest
@testable import CerniqDomain

final class CerniqDomainTests: XCTestCase {
    func testAuthUserDecodesWorkspaceIdentifiers() throws {
        let data = Data(
            """
            {
              "id": "user_123",
              "email": "ana@coop.pr",
              "name": "Ana Rivera",
              "workspaceId": "ws_123",
              "workspaceName": "CoopAhorro Workspace",
              "subscriptionTier": "annual"
            }
            """.utf8
        )

        let user = try JSONDecoder().decode(AuthUser.self, from: data)

        XCTAssertEqual(user.workspaceID, "ws_123")
        XCTAssertEqual(user.workspaceName, "CoopAhorro Workspace")
        XCTAssertEqual(user.subscriptionTier, "annual")
    }

    func testALMSummaryDecodesInstitutionIdentifier() throws {
        let data = Data(
            """
            {
              "institutionId": "inst_123",
              "durationGap": 1.8,
              "riskRating": "asset-sensitive",
              "liquidityCoverageRatio": 115.5,
              "netInterestMargin": 3.15
            }
            """.utf8
        )

        let summary = try JSONDecoder().decode(ALMSummary.self, from: data)

        XCTAssertEqual(summary.institutionID, "inst_123")
        XCTAssertEqual(summary.liquidityCoverageRatio, 115.5)
    }
}
