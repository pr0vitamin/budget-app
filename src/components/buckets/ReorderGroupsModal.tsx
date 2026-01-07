'use client';

import { useState } from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableItem {
    id: string;
    name: string;
}

interface SortableGroupItemProps {
    item: SortableItem;
}

function SortableGroupItem({ item }: SortableGroupItemProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: item.id,
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="flex items-center gap-3 bg-white rounded-xl p-4 shadow-sm"
        >
            <button
                {...attributes}
                {...listeners}
                className="p-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing touch-none"
            >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 8h16M4 16h16"
                    />
                </svg>
            </button>
            <span className="flex-1 font-medium text-gray-800">{item.name}</span>
        </div>
    );
}

interface ReorderGroupsModalProps {
    groups: SortableItem[];
    onSave: (orderedIds: string[]) => Promise<void>;
    onCancel: () => void;
}

export function ReorderGroupsModal({ groups, onSave, onCancel }: ReorderGroupsModalProps) {
    const [items, setItems] = useState(groups);
    const [isSaving, setIsSaving] = useState(false);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setItems((items) => {
                const oldIndex = items.findIndex((i) => i.id === active.id);
                const newIndex = items.findIndex((i) => i.id === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
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
                <p className="text-gray-500 text-sm mb-4">Drag and drop to reorder your clowders</p>

                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                        <div className="space-y-2">
                            {items.map((item) => (
                                <SortableGroupItem key={item.id} item={item} />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>

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
