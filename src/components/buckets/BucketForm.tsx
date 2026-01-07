'use client';

import { useState } from 'react';

interface BucketFormData {
    name: string;
    type: 'spending' | 'savings';
    color: string;
    icon?: string;
    autoAllocationAmount: number;
    rollover: boolean;
    rolloverTargetId?: string;
}

interface BucketFormProps {
    groupId: string;
    initialData?: Partial<BucketFormData>;
    bucketId?: string; // If editing
    onSubmit: (data: BucketFormData) => Promise<void>;
    onCancel: () => void;
    onDelete?: () => Promise<void>;
}

const colorOptions = [
    '#6366f1', // Indigo
    '#8b5cf6', // Violet
    '#ec4899', // Pink
    '#ef4444', // Red
    '#f97316', // Orange
    '#eab308', // Yellow
    '#22c55e', // Green
    '#14b8a6', // Teal
    '#0ea5e9', // Sky
    '#6b7280', // Gray
];

export function BucketForm({
    initialData,
    bucketId,
    onSubmit,
    onCancel,
    onDelete,
}: BucketFormProps) {
    const [formData, setFormData] = useState<BucketFormData>({
        name: initialData?.name || '',
        type: initialData?.type || 'spending',
        color: initialData?.color || '#6366f1',
        icon: initialData?.icon,
        autoAllocationAmount: initialData?.autoAllocationAmount || 0,
        rollover: initialData?.rollover ?? true,
        rolloverTargetId: initialData?.rolloverTargetId,
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim()) return;

        setIsSubmitting(true);
        try {
            await onSubmit(formData);
        } finally {
            setIsSubmitting(false);
        }
    };

    const isEditing = !!bucketId;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50">
            <div className="bg-white w-full max-w-lg rounded-t-3xl p-6 animate-slide-up">
                <h2 className="text-xl font-bold text-gray-800 mb-4">
                    {isEditing ? 'Edit Cat' : 'Create Cat'}
                </h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
                            placeholder="e.g., Groceries"
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            autoFocus
                        />
                    </div>

                    {/* Type */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => setFormData((f) => ({ ...f, type: 'spending' }))}
                                className={`py-3 rounded-xl font-medium transition-colors ${formData.type === 'spending'
                                    ? 'bg-indigo-500 text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                            >
                                💸 Spending
                            </button>
                            <button
                                type="button"
                                onClick={() => setFormData((f) => ({ ...f, type: 'savings' }))}
                                className={`py-3 rounded-xl font-medium transition-colors ${formData.type === 'savings'
                                    ? 'bg-indigo-500 text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                            >
                                🐷 Savings
                            </button>
                        </div>
                    </div>

                    {/* Color */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
                        <div className="flex gap-2 flex-wrap">
                            {colorOptions.map((color) => (
                                <button
                                    key={color}
                                    type="button"
                                    onClick={() => setFormData((f) => ({ ...f, color }))}
                                    className={`w-10 h-10 rounded-full transition-transform ${formData.color === color ? 'ring-2 ring-offset-2 ring-indigo-500 scale-110' : ''
                                        }`}
                                    style={{ backgroundColor: color }}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Auto-allocation amount */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Auto-allocation (per budget cycle)
                        </label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                            <input
                                type="number"
                                value={formData.autoAllocationAmount || ''}
                                onChange={(e) =>
                                    setFormData((f) => ({
                                        ...f,
                                        autoAllocationAmount: parseFloat(e.target.value) || 0,
                                    }))
                                }
                                placeholder="0.00"
                                step="0.01"
                                min="0"
                                className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                    </div>

                    {/* Rollover */}
                    <div className="flex items-center justify-between py-2">
                        <div>
                            <p className="font-medium text-gray-800">Roll over balance</p>
                            <p className="text-sm text-gray-500">Keep unused funds for next period</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setFormData((f) => ({ ...f, rollover: !f.rollover }))}
                            className={`w-12 h-7 rounded-full transition-colors ${formData.rollover ? 'bg-indigo-500' : 'bg-gray-300'
                                }`}
                        >
                            <div
                                className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${formData.rollover ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                            />
                        </button>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="flex-1 py-3 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || !formData.name.trim()}
                            className="flex-1 py-3 bg-indigo-500 text-white font-medium rounded-xl hover:bg-indigo-600 transition-colors disabled:opacity-50"
                        >
                            {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Cat'}
                        </button>
                    </div>

                    {/* Delete button for editing */}
                    {isEditing && onDelete && (
                        <button
                            type="button"
                            onClick={onDelete}
                            className="w-full py-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                        >
                            Delete Cat
                        </button>
                    )}
                </form>
            </div>
        </div>
    );
}
