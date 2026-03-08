import axios, { AxiosInstance } from 'axios';

const API_URL = (
    process.env.NEXT_PUBLIC_NODE_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    ''
).trim().replace(/\/+$/, '');

// Types
export interface Workspace {
    id: string;
    name: string;
    company_name?: string;
    created_at: string;
    stats?: WorkspaceStats;
}

export interface WorkspaceStats {
    total_uploads: number;
    total_invoices: number;
    total_vendors: number;
    total_findings: number;
    total_spend_analyzed: number;
    total_potential_savings: number;
}

export interface Finding {
    id: string;
    workspace_id: string;
    finding_type: string;
    severity: number;
    status: string;
    entity_id?: string;
    entity_name?: string;
    title: string;
    explanation: string;
    evidence?: Record<string, unknown>;
    potential_savings?: number;
    recommended_action?: string;
    created_at: string;
}

export interface FindingsListResponse {
    findings: Finding[];
    total_count: number;
    total_savings: number;
}

export interface FindingsStats {
    total_findings: number;
    by_type: { finding_type: string; count: number; total_amount: number }[];
    by_status: { status: string; count: number }[];
    total_potential_savings: number;
    resolved_savings: number;
}

export interface AnalysisResult {
    message: string;
    invoices_parsed: number;
    vendors_created: number;
    findings_found: number;
    findings_by_type: Record<string, number>;
    total_potential_savings: number;
    status: string;
}

export interface AnalysisStatus {
    workspace_id: string;
    total_invoices: number;
    total_findings: number;
    pending_uploads: number;
    total_potential_savings: number;
    status: string;
}

class SpendCheckAPI {
    private client: AxiosInstance;

    constructor() {
        this.client = axios.create({
            baseURL: API_URL,
            headers: {
                'Content-Type': 'application/json',
            },
            withCredentials: true,
        });
    }

    // Workspace APIs
    async createWorkspace(name: string, company_name?: string): Promise<Workspace> {
        return Promise.resolve({
            id: `ws-${Date.now()}`,
            name,
            company_name: company_name || name,
            created_at: new Date().toISOString(),
            stats: {
                total_uploads: 0,
                total_invoices: 0,
                total_vendors: 0,
                total_findings: 0,
                total_spend_analyzed: 0,
                total_potential_savings: 0,
            }
        });
    }

    async listWorkspaces(): Promise<Workspace[]> {
        return Promise.resolve([
            {
                id: 'demo-workspace-1',
                name: 'Q4 Audit 2025',
                company_name: 'Acme Corp',
                created_at: new Date().toISOString(),
                stats: {
                    total_uploads: 12,
                    total_invoices: 450,
                    total_vendors: 85,
                    total_findings: 14,
                    total_spend_analyzed: 1250000,
                    total_potential_savings: 45000,
                }
            }
        ]);
    }

    async getWorkspace(id: string): Promise<Workspace> {
        return Promise.resolve({
            id,
            name: 'Q4 Audit 2025',
            company_name: 'Acme Corp',
            created_at: new Date().toISOString(),
            stats: {
                total_uploads: 12,
                total_invoices: 450,
                total_vendors: 85,
                total_findings: 14,
                total_spend_analyzed: 1250000,
                total_potential_savings: 45000,
            }
        });
    }

    async updateWorkspace(id: string, updates: { name?: string; company_name?: string }): Promise<Workspace> {
        return Promise.resolve({
            id,
            name: updates.name || 'Updated Workspace',
            company_name: updates.company_name || 'Acme Corp',
            created_at: new Date().toISOString(),
        });
    }

    async deleteWorkspace(id: string): Promise<void> {
        return Promise.resolve();
    }

    // Upload APIs
    async uploadFile(workspaceId: string, file: File): Promise<{ id: string; file_name: string }> {
        return Promise.resolve({
            id: `upload-${Date.now()}`,
            file_name: file.name,
        });
    }

    // Analysis APIs
    async runAnalysis(uploadId: string, workspaceId: string): Promise<AnalysisResult> {
        return Promise.resolve({
            message: 'Analysis completed successfully',
            invoices_parsed: 152,
            vendors_created: 14,
            findings_found: 8,
            findings_by_type: { 'duplicate_invoice': 3, 'overcharge': 5 },
            total_potential_savings: 12500,
            status: 'completed'
        });
    }

    async getAnalysisStatus(workspaceId: string): Promise<AnalysisStatus> {
        return Promise.resolve({
            workspace_id: workspaceId,
            total_invoices: 450,
            total_findings: 14,
            pending_uploads: 0,
            total_potential_savings: 45000,
            status: 'completed'
        });
    }

    // Findings APIs
    async listFindings(params: {
        workspace_id: string;
        type?: string;
        status?: string;
        severity_min?: number;
        limit?: number;
        offset?: number;
    }): Promise<FindingsListResponse> {
        return Promise.resolve({
            findings: [
                {
                    id: 'find-1',
                    workspace_id: params.workspace_id,
                    finding_type: 'duplicate_invoice',
                    severity: 8,
                    status: 'open',
                    entity_name: 'Oracle Services',
                    title: 'Possible Duplicate Invoice',
                    explanation: 'Two invoices detected with the identical total ($4,500) and line items billed within 48 hours.',
                    potential_savings: 4500,
                    created_at: new Date().toISOString()
                },
                {
                    id: 'find-2',
                    workspace_id: params.workspace_id,
                    finding_type: 'price_variance',
                    severity: 6,
                    status: 'open',
                    entity_name: 'AWS Cloud',
                    title: 'Pricing Tier Variance',
                    explanation: 'Compute costs for us-east-1 appear 15% higher than the negotiated contract rate from last quarter.',
                    potential_savings: 2150,
                    created_at: new Date().toISOString()
                }
            ],
            total_count: 2,
            total_savings: 6650
        });
    }

    async getFinding(id: string): Promise<Finding> {
        return Promise.resolve({
            id,
            workspace_id: 'demo-workspace-1',
            finding_type: 'duplicate_invoice',
            severity: 8,
            status: 'open',
            entity_name: 'Oracle Services',
            title: 'Possible Duplicate Invoice',
            explanation: 'Detailed evidence suggests this invoice was previously paid.',
            potential_savings: 4500,
            created_at: new Date().toISOString()
        });
    }

    async updateFinding(id: string, status: string): Promise<void> {
        return Promise.resolve();
    }

    async submitFeedback(findingId: string, isTruePositive: boolean, notes?: string): Promise<void> {
        return Promise.resolve();
    }

    async getFindingsStats(workspaceId: string): Promise<FindingsStats> {
        return Promise.resolve({
            total_findings: 14,
            by_type: [
                { finding_type: 'duplicate_invoice', count: 5, total_amount: 15000 },
                { finding_type: 'price_variance', count: 9, total_amount: 30000 }
            ],
            by_status: [
                { status: 'open', count: 10 },
                { status: 'resolved', count: 4 }
            ],
            total_potential_savings: 45000,
            resolved_savings: 12000
        });
    }

    // Report APIs
    async generateReport(workspaceId: string): Promise<{ id: string }> {
        return Promise.resolve({ id: `report-${Date.now()}` });
    }

    async getReport(id: string): Promise<Record<string, unknown>> {
        return Promise.resolve({
            id,
            summary: "Comprehensive SpendCheck audit found multiple anomalies.",
            total_findings: 14,
            total_savings: 45000,
            generated_at: new Date().toISOString()
        });
    }
}

export const spendcheckApi = new SpendCheckAPI();
