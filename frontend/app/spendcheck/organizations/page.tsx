'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Organization {
    id: string;
    name: string;
    slug: string;
    description?: string;
    logoUrl?: string;
    createdAt: string;
    members: OrganizationMember[];
    _count?: { expenses: number };
}

interface OrganizationMember {
    id: string;
    role: 'ADMIN' | 'MEMBER' | 'VIEWER';
    joinedAt: string;
    user: {
        id: string;
        email: string;
        name?: string;
        avatarUrl?: string;
    };
}

const API_URL = (
    process.env.NEXT_PUBLIC_NODE_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    ''
).trim().replace(/\/+$/, '');

export default function OrganizationsPage() {
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showInviteModal, setShowInviteModal] = useState<string | null>(null);
    const [formData, setFormData] = useState({ name: '', slug: '', description: '' });
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<'ADMIN' | 'MEMBER' | 'VIEWER'>('MEMBER');

    useEffect(() => {
        fetchOrganizations();
    }, []);

    async function fetchOrganizations() {
        try {
            const res = await fetch(`${API_URL}/api/organizations`, {
                headers: { 'x-user-id': localStorage.getItem('userId') || 'demo-user' },
            });
            const data = await res.json();
            setOrganizations(data);
        } catch (err) {
            console.error('Failed to load orgs:', err);
        } finally {
            setLoading(false);
        }
    }

    async function createOrganization() {
        if (!formData.name || !formData.slug) return;
        try {
            const res = await fetch(`${API_URL}/api/organizations`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': localStorage.getItem('userId') || 'demo-user',
                },
                body: JSON.stringify(formData),
            });
            const org = await res.json();
            setOrganizations([org, ...organizations]);
            setShowCreateModal(false);
            setFormData({ name: '', slug: '', description: '' });
        } catch (err) {
            console.error('Failed to create org:', err);
        }
    }

    async function inviteMember(orgId: string) {
        if (!inviteEmail) return;
        try {
            await fetch(`${API_URL}/api/organizations/${orgId}/members`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': localStorage.getItem('userId') || 'demo-user',
                },
                body: JSON.stringify({ userId: inviteEmail, role: inviteRole }),
            });
            setShowInviteModal(null);
            setInviteEmail('');
            fetchOrganizations();
        } catch (err) {
            console.error('Failed to invite:', err);
        }
    }

    async function removeMember(orgId: string, userId: string) {
        try {
            await fetch(`${API_URL}/api/organizations/${orgId}/members/${userId}`, {
                method: 'DELETE',
                headers: { 'x-user-id': localStorage.getItem('userId') || 'demo-user' },
            });
            fetchOrganizations();
        } catch (err) {
            console.error('Failed to remove member:', err);
        }
    }

    const roleColors: Record<string, string> = {
        ADMIN: 'bg-red-500/20 text-red-400 border-red-500/30',
        MEMBER: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        VIEWER: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-950 text-white">
            {/* Header */}
            <div className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/spendcheck" className="text-gray-400 hover:text-white transition">← Back</Link>
                        <h1 className="text-2xl font-bold">Organizations</h1>
                    </div>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-lg font-medium transition flex items-center gap-2"
                    >
                        <span>+</span> New Organization
                    </button>
                </div>
            </div>

            {/* Organizations Grid */}
            <div className="max-w-7xl mx-auto px-6 py-8">
                {organizations.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="text-6xl mb-4">🏢</div>
                        <h2 className="text-2xl font-bold mb-2">No Organizations Yet</h2>
                        <p className="text-gray-400 mb-6">Create your first organization to start managing team expenses.</p>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="bg-emerald-600 hover:bg-emerald-500 px-6 py-3 rounded-lg font-medium transition"
                        >
                            Create Organization
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {organizations.map(org => (
                            <div key={org.id} className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition">
                                {/* Org Header */}
                                <div className="flex items-start justify-between mb-4">
                                    <div>
                                        <h3 className="text-xl font-bold mb-1">{org.name}</h3>
                                        <p className="text-gray-500 text-sm">/{org.slug}</p>
                                        {org.description && <p className="text-gray-400 text-sm mt-2">{org.description}</p>}
                                    </div>
                                    <div className="flex gap-2 text-sm">
                                        <span className="bg-gray-800 px-3 py-1 rounded-full">{org.members?.length || 0} members</span>
                                        <span className="bg-emerald-900/50 text-emerald-400 px-3 py-1 rounded-full">{org._count?.expenses || 0} expenses</span>
                                    </div>
                                </div>

                                {/* Members List */}
                                <div className="border-t border-gray-800 pt-4 mt-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <h4 className="text-sm font-semibold text-gray-400">Team Members</h4>
                                        <button
                                            onClick={() => setShowInviteModal(org.id)}
                                            className="text-emerald-400 hover:text-emerald-300 text-sm transition"
                                        >
                                            + Invite
                                        </button>
                                    </div>
                                    <div className="space-y-2">
                                        {org.members?.slice(0, 5).map(member => (
                                            <div key={member.id} className="flex items-center justify-between group">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-sm font-bold">
                                                        {(member.user.name || member.user.email)[0].toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium">{member.user.name || member.user.email}</p>
                                                        <p className="text-xs text-gray-500">{member.user.email}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-xs px-2 py-0.5 rounded border ${roleColors[member.role]}`}>
                                                        {member.role}
                                                    </span>
                                                    <button
                                                        onClick={() => removeMember(org.id, member.user.id)}
                                                        className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition text-sm"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                        {(org.members?.length || 0) > 5 && (
                                            <p className="text-xs text-gray-500 text-center pt-1">
                                                +{org.members.length - 5} more members
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Org Actions */}
                                <div className="border-t border-gray-800 pt-4 mt-4 flex gap-3">
                                    <Link
                                        href={`/spendcheck/expenses?org=${org.id}`}
                                        className="flex-1 text-center bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition"
                                    >
                                        View Expenses
                                    </Link>
                                    <Link
                                        href={`/spendcheck/analytics?org=${org.id}`}
                                        className="flex-1 text-center bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition"
                                    >
                                        Analytics
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowCreateModal(false)}>
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                        <h2 className="text-xl font-bold mb-4">Create Organization</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Name</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => {
                                        setFormData({
                                            ...formData,
                                            name: e.target.value,
                                            slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
                                        });
                                    }}
                                    placeholder="Acme Corp"
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Slug</label>
                                <div className="flex items-center bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
                                    <span className="px-3 text-gray-500 text-sm bg-gray-800/50">/</span>
                                    <input
                                        type="text"
                                        value={formData.slug}
                                        onChange={e => setFormData({ ...formData, slug: e.target.value })}
                                        placeholder="acme-corp"
                                        className="flex-1 bg-transparent px-2 py-2 text-white focus:outline-none"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Description (optional)</label>
                                <textarea
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Team description..."
                                    rows={2}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none resize-none"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-gray-400 hover:text-white transition">Cancel</button>
                            <button onClick={createOrganization} disabled={!formData.name || !formData.slug} className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:cursor-not-allowed px-4 py-2 rounded-lg font-medium transition">Create</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Invite Modal */}
            {showInviteModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowInviteModal(null)}>
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                        <h2 className="text-xl font-bold mb-4">Invite Team Member</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Email Address</label>
                                <input
                                    type="email"
                                    value={inviteEmail}
                                    onChange={e => setInviteEmail(e.target.value)}
                                    placeholder="colleague@company.com"
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Role</label>
                                <select
                                    value={inviteRole}
                                    onChange={e => setInviteRole(e.target.value as any)}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                >
                                    <option value="ADMIN">Admin — Full access, can manage members</option>
                                    <option value="MEMBER">Member — Can submit and view expenses</option>
                                    <option value="VIEWER">Viewer — Read-only access</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setShowInviteModal(null)} className="px-4 py-2 text-gray-400 hover:text-white transition">Cancel</button>
                            <button onClick={() => inviteMember(showInviteModal)} disabled={!inviteEmail} className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:cursor-not-allowed px-4 py-2 rounded-lg font-medium transition">Send Invite</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
