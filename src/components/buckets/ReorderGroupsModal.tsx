'use client';

import { useState } from 'react';

interface SortableItem {
    id: string;
    name: string;
}

interface ReorderGroupsModalProps {
    groups: SortableItem[];
    onSave: (orderedIds: string[]) => Promise<void>;
    onCancel: () => void;
}

export function ReorderGroupsModal({ groups, onSave, onCancel }: ReorderGroupsModalProps) {
    const [items, setItems] = useState(groups);
    const [isSaving, setIsSaving] = useState(false);

    const moveUp = (index: number) => {
        if (index === 0) return;
        setItems((prev) => {
            const next = [...prev];
            [next[index - 1], next[index]] = [next[index], next[index - 1]];
            return next;
        });
    };

    const moveDown = (index: number) => {
        if (index === items.length - 1) return;
        setItems((prev) => {
            const next = [...prev];
            [next[index], next[index + 1]] = [next[index + 1], next[index]];
            return next;
        });
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onSave(items.map((i) => i.id));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50">
            <div className="bg-gray-50 w-full max-w-lg rounded-t-3xl p-6 max-h-[80vh] overflow-y-auto">
                <h2 className="text-xl font-bold text-gray-800 mb-4">Reorder Groups</h2>
                <p className="text-gray-500 text-sm mb-4">Use ▲ / ▼ to reorder your clowders</p>

                <div className="space-y-2">
                    {items.map((item, index) => (
                        <div
                            key={item.id}
                            className="flex items-center gap-3 bg-white rounded-xl p-4 shadow-sm"
                        >
                            <div className="flex flex-col gap-1">
                                <button
                                    type="button"
                                    onClick={() => moveUp(index)}
                                    disabled={index === 0}
                                    className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30 transition-opacity"
                                    aria-label="Move up"
                                >
                                    ▲
                                </button>
                                <button
                                    type="button"
                                    onClick={() => moveDown(index)}
                                    disabled={index === items.length - 1}
                                    className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30 transition-opacity"
                                    aria-label="Move down"
                                >
                                    ▼
                                </button>
                            </div>
                            <span className="flex-1 font-medium text-gray-800">{item.name}</span>
                        </div>
                    ))}
                </div>

                <div className="flex gap-3 mt-6">
                    <button
                        onClick={onCancel}
                        className="flex-1 py-3 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex-1 py-3 bg-indigo-500 text-white font-medium rounded-xl hover:bg-indigo-600 transition-colors disabled:opacity-50"
                    >
                        {isSaving ? 'Saving...' : 'Save Order'}
                    </button>
                </div>
            </div>
        </div>
    );
}
