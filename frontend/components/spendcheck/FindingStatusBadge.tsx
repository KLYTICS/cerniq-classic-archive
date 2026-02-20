export default function FindingStatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        new: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        triaged: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
        investigating: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
        resolved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        ignored: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
    };

    const labels: Record<string, string> = {
        new: 'New',
        triaged: 'Triaged',
        investigating: 'In Progress',
        resolved: 'Resolved',
        ignored: 'Ignored',
    };

    return (
        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${styles[status] || styles.new}`}>
            {labels[status] || status}
        </span>
    );
}
