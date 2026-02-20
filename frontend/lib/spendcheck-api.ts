import axios, { AxiosInstance } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

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
        const response = await this.client.post('/api/spendcheck/workspaces', { name, company_name });
        return response.data;
    }

    async listWorkspaces(): Promise<Workspace[]> {
        const response = await this.client.get('/api/spendcheck/workspaces');
        return response.data;
    }

    async getWorkspace(id: string): Promise<Workspace> {
        const response = await this.client.get(`/api/spendcheck/workspaces/${id}`);
        return response.data;
    }

    async updateWorkspace(id: string, updates: { name?: string; company_name?: string }): Promise<Workspace> {
        const response = await this.client.put(`/api/spendcheck/workspaces/${id}`, updates);
        return response.data;
    }

    async deleteWorkspace(id: string): Promise<void> {
        await this.client.delete(`/api/spendcheck/workspaces/${id}`);
    }

    // Upload APIs
    async uploadFile(workspaceId: string, file: File): Promise<{ id: string; file_name: string }> {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('workspace_id', workspaceId);

        const response = await this.client.post('/api/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return response.data;
    }

    // Analysis APIs
    async runAnalysis(uploadId: string, workspaceId: string): Promise<AnalysisResult> {
        const response = await this.client.post('/api/analyze', {
            upload_id: uploadId,
            workspace_id: workspaceId,
        });
        return response.data;
    }

    async getAnalysisStatus(workspaceId: string): Promise<AnalysisStatus> {
        const response = await this.client.get(`/api/analyze/status/${workspaceId}`);
        return response.data;
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
        const response = await this.client.get('/api/spendcheck/findings', { params });
        return response.data;
    }

    async getFinding(id: string): Promise<Finding> {
        const response = await this.client.get(`/api/spendcheck/findings/${id}`);
        return response.data;
    }

    async updateFinding(id: string, status: string): Promise<void> {
        await this.client.patch(`/api/spendcheck/findings/${id}`, { status });
    }

    async submitFeedback(findingId: string, isTruePositive: boolean, notes?: string): Promise<void> {
        await this.client.post(`/api/spendcheck/findings/${findingId}/feedback`, {
            is_true_positive: isTruePositive,
            notes,
        });
    }

    async getFindingsStats(workspaceId: string): Promise<FindingsStats> {
        const response = await this.client.get('/api/spendcheck/findings/stats', {
            params: { workspace_id: workspaceId },
        });
        return response.data;
    }

    // Report APIs
    async generateReport(workspaceId: string): Promise<{ id: string }> {
        const response = await this.client.post('/api/reports/generate', { workspace_id: workspaceId });
        return response.data;
    }

    async getReport(id: string): Promise<Record<string, unknown>> {
        const response = await this.client.get(`/api/reports/${id}`);
        return response.data;
    }
}

export const spendcheckApi = new SpendCheckAPI();
