'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Bucket {
    id: string;
    name: string;
    color: string;
}

interface ScheduledTransaction {
    id: string;
    name: string;
    amount: number;
    frequency: string;
    interval: number;
    nextDue: string;
    startDate: string;
    enabled: boolean;
    bucket: Bucket;
}

interface BucketGroup {
    id: string;
    name: string;
    buckets: Bucket[];
}

interface ScheduledPageClientProps {
    scheduled: ScheduledTransaction[];
    bucketGroups: BucketGroup[];
}

const FREQUENCY_LABELS: Record<string, string> = {
    weekly: 'Weekly',
    fortnightly: 'Fortnightly',
    monthly: 'Monthly',
    yearly: 'Yearly',
    custom: 'Custom',
};

export default function ScheduledPageClient({
    scheduled,
    bucketGroups,
}: ScheduledPageClientProps) {
    const router = useRouter();
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        amount: '',
        bucketId: '',
        frequency: 'monthly',
        interval: 1,
        startDate: new Date().toISOString().split('T')[0],
    });

    const resetForm = () => {
        setFormData({
            name: '',
            amount: '',
            bucketId: '',
            frequency: 'monthly',
            interval: 1,
            startDate: new Date().toISOString().split('T')[0],
        });
        setEditingId(null);
        setShowForm(false);
    };

    const handleEdit = (item: ScheduledTransaction) => {
        setFormData({
            name: item.name,
            amount: Math.abs(item.amount).toString(),
            bucketId: item.bucket.id,
            frequency: item.frequency,
            interval: item.interval,
            startDate: item.startDate.split('T')[0],
        });
        setEditingId(item.id);
        setShowForm(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsSubmitting(true);

        const payload = {
            ...formData,
            amount: -Math.abs(parseFloat(formData.amount)), // Expenses are negative
        };

        try {
            const url = editingId ? `/api/scheduled/${editingId}` : '/api/scheduled';
            const method = editingId ? 'PATCH' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const data = await res.json();
                setError(data.error || 'Failed to save');
                return;
            }

            resetForm();
            router.refresh();
        } catch {
            setError('Failed to save scheduled transaction');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;

        try {
            const res = await fetch(`/api/scheduled/${id}`, { method: 'DELETE' });
            if (res.ok) {
                router.refresh();
            }
        } catch {
            setError('Failed to delete');
        }
    };

    const handleToggleEnabled = async (item: ScheduledTransaction) => {
        try {
            await fetch(`/api/scheduled/${item.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: !item.enabled }),
            });
            router.refresh();
        } catch {
            setError('Failed to update');
        }
    };

    const formatNextDue = (date: string) => {
        const d = new Date(date);
        const now = new Date();
        const diff = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (diff < 0) return `${Math.abs(diff)} days overdue`;
        if (diff === 0) return 'Today';
        if (diff === 1) return 'Tomorrow';
        if (diff <= 7) return `In ${diff} days`;

        return d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' });
    };

    return (
        <div className="p-4 pb-24 max-w-lg mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Upcoming</h1>
                <button
                    onClick={() => setShowForm(true)}
                    className="w-10 h-10 bg-indigo-500 text-white rounded-full flex items-center justify-center text-2xl font-light shadow-lg hover:bg-indigo-600"
                >
                    +
                </button>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg mb-4 text-sm">
                    {error}
                </div>
            )}

            {/* List */}
            {scheduled.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                    <p className="text-lg mb-2">No scheduled transactions</p>
                    <p className="text-sm">Add recurring bills and payments to track them automatically</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {scheduled.map((item) => (
                        <div
                            key={item.id}
                            className={`bg-white rounded-xl p-4 shadow-sm ${!item.enabled ? 'opacity-50' : ''}`}
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div
                                            className="w-3 h-3 rounded-full"
                                            style={{ backgroundColor: item.bucket.color }}
                                        />
                                        <span className="font-medium text-gray-800">{item.name}</span>
                                    </div>
                                    <div className="text-sm text-gray-500">
                                        {item.bucket.name} • {FREQUENCY_LABELS[item.frequency]}
                                    </div>
                                    <div className="text-sm text-indigo-600 mt-1">
                                        {formatNextDue(item.nextDue)}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-bold text-gray-800">
                                        ${Math.abs(item.amount).toFixed(2)}
                                    </div>
                                    <div className="flex gap-2 mt-2">
                                        <button
                                            onClick={() => handleToggleEnabled(item)}
                                            className={`text-xs px-2 py-1 rounded ${item.enabled
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-gray-100 text-gray-600'
                                                }`}
                                        >
                                            {item.enabled ? 'Active' : 'Paused'}
                                        </button>
                                        <button
                                            onClick={() => handleEdit(item)}
                                            className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleDelete(item.id, item.name)}
                                            className="text-xs px-2 py-1 rounded bg-red-100 text-red-600"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Form Modal */}
            {showForm && (
                <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50">
                    <div className="bg-white w-full max-w-lg rounded-t-3xl p-6 animate-slide-up max-h-[85vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-gray-800">
                                {editingId ? 'Edit Scheduled' : 'New Scheduled Transaction'}
                            </h2>
                            <button
                                onClick={resetForm}
                                className="text-gray-400 hover:text-gray-600 text-2xl"
                            >
                                ×
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Name */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Name
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g., Netflix Subscription"
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    required
                                />
                            </div>

                            {/* Amount */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Amount
                                </label>
                                <div className="relative">
                                    <span className="absolute left-4 top-3 text-gray-500">$</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0.01"
                                        value={formData.amount}
                                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                        placeholder="0.00"
                                        className="w-full pl-8 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Bucket */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Cat
                                </label>
                                <select
                                    value={formData.bucketId}
                                    onChange={(e) => setFormData({ ...formData, bucketId: e.target.value })}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    required
                                >
                                    <option value="">Select a cat...</option>
                                    {bucketGroups.map((group) => (
                                        <optgroup key={group.id} label={group.name}>
                                            {group.buckets.map((bucket) => (
                                                <option key={bucket.id} value={bucket.id}>
                                                    {bucket.name}
                                                </option>
                                            ))}
                                        </optgroup>
                                    ))}
                                </select>
                            </div>

                            {/* Frequency */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Frequency
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(['weekly', 'fortnightly', 'monthly', 'yearly'] as const).map((freq) => (
                                        <button
                                            key={freq}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, frequency: freq })}
                                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${formData.frequency === freq
                                                ? 'bg-indigo-500 text-white'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                }`}
                                        >
                                            {FREQUENCY_LABELS[freq]}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Custom interval (if frequency is custom) */}
                            {formData.frequency === 'custom' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Every X days
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={formData.interval}
                                        onChange={(e) => setFormData({ ...formData, interval: parseInt(e.target.value) })}
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                            )}

                            {/* Start Date */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Start Date
                                </label>
                                <input
                                    type="date"
                                    value={formData.startDate}
                                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    required
                                />
                            </div>

                            {/* Submit */}
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full py-3 bg-indigo-500 text-white font-medium rounded-xl hover:bg-indigo-600 transition-colors disabled:opacity-50"
                            >
                                {isSubmitting ? 'Saving...' : editingId ? 'Update' : 'Add Scheduled Transaction'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
