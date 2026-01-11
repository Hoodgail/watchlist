import React, { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
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
import { CollectionItem, MediaType } from '../types';
import * as api from '../services/api';
import { useToast } from '../context/ToastContext';

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w200';

const getImageUrl = (imageUrl?: string | null): string | null => {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('http')) return imageUrl;
  if (imageUrl.startsWith('/')) return `${TMDB_IMAGE_BASE}${imageUrl}`;
  return imageUrl;
};

interface CollectionItemListProps {
  collectionId: string;
  items: CollectionItem[];
  canEdit: boolean;
  onItemsChange: (items: CollectionItem[]) => void;
  onAddItem: () => void;
}

interface SortableItemProps {
  item: CollectionItem;
  collectionId: string;
  canEdit: boolean;
  onNoteUpdate: (itemId: string, note: string) => void;
  onRemove: (itemId: string) => void;
}

const SortableItem: React.FC<SortableItemProps> = ({
  item,
  collectionId,
  canEdit,
  onNoteUpdate,
  onRemove,
}) => {
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteValue, setNoteValue] = useState(item.note || '');
  const [imageError, setImageError] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const imageUrl = getImageUrl(item.imageUrl || item.source?.imageUrl);
  const title = item.title || item.source?.title || 'Unknown Title';

  const handleNoteSave = () => {
    setIsEditingNote(false);
    if (noteValue !== (item.note || '')) {
      onNoteUpdate(item.id, noteValue);
    }
  };

  const handleNoteKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleNoteSave();
    } else if (e.key === 'Escape') {
      setNoteValue(item.note || '');
      setIsEditingNote(false);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border border-neutral-800 hover:border-neutral-600 bg-black transition-colors"
    >
      <div className="flex items-center gap-3 p-3">
        {/* Drag Handle */}
        {canEdit && (
          <button
            {...attributes}
            {...listeners}
            className="text-neutral-600 hover:text-white cursor-grab active:cursor-grabbing p-1 touch-none"
            aria-label="Drag to reorder"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <circle cx="9" cy="6" r="1.5" />
              <circle cx="15" cy="6" r="1.5" />
              <circle cx="9" cy="12" r="1.5" />
              <circle cx="15" cy="12" r="1.5" />
              <circle cx="9" cy="18" r="1.5" />
              <circle cx="15" cy="18" r="1.5" />
            </svg>
          </button>
        )}

        {/* Image/Poster */}
        <div className="flex-shrink-0 w-12 h-16 bg-neutral-900 border border-neutral-800 overflow-hidden">
          {imageUrl && !imageError ? (
            <img
              src={imageUrl}
              alt={title}
              className="w-full h-full object-cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-neutral-700 text-xs">
              NO IMG
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-grow min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-bold text-sm uppercase tracking-tight text-white truncate">
              {title}
            </h4>
            <span className="bg-neutral-900 text-neutral-400 text-xs uppercase px-1.5 py-0.5 flex-shrink-0">
              {item.type}
            </span>
            {item.year && (
              <span className="text-neutral-500 text-xs">
                {item.year}
              </span>
            )}
            {item.genres && item.genres.length > 0 && (
              <span className="text-neutral-600 text-xs">
                {item.genres.slice(0, 2).join(' · ')}
              </span>
            )}
          </div>

          {/* Note */}
          {canEdit ? (
            isEditingNote ? (
              <input
                type="text"
                value={noteValue}
                onChange={(e) => setNoteValue(e.target.value)}
                onBlur={handleNoteSave}
                onKeyDown={handleNoteKeyDown}
                autoFocus
                placeholder="Add a note..."
                className="mt-1 w-full bg-neutral-900 border border-neutral-700 text-sm text-neutral-300 px-2 py-1 outline-none focus:border-white"
              />
            ) : (
              <button
                onClick={() => setIsEditingNote(true)}
                className="mt-1 text-xs text-neutral-500 hover:text-neutral-300 transition-colors text-left"
              >
                {item.note || 'Click to add note...'}
              </button>
            )
          ) : item.note ? (
            <p className="mt-1 text-xs text-neutral-500">{item.note}</p>
          ) : null}
        </div>

        {/* Remove Button */}
        {canEdit && (
          <button
            onClick={() => onRemove(item.id)}
            className="text-neutral-600 hover:text-red-500 transition-colors p-2"
            aria-label="Remove item"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

export const CollectionItemList: React.FC<CollectionItemListProps> = ({
  collectionId,
  items,
  canEdit,
  onItemsChange,
  onAddItem,
}) => {
  const { showToast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);

      const newItems = arrayMove(items, oldIndex, newIndex);
      
      // Update local state immediately for responsiveness
      onItemsChange(newItems);

      // Persist to server
      try {
        const reorderPayload = newItems.map((item, index) => ({
          id: item.id,
          orderIndex: index,
        }));
        await api.reorderCollectionItems(collectionId, reorderPayload);
      } catch (error) {
        console.error('Failed to reorder items:', error);
        showToast('Failed to save new order', 'error');
        // Revert on error
        onItemsChange(items);
      }
    }
  };

  const handleNoteUpdate = async (itemId: string, note: string) => {
    try {
      await api.updateCollectionItem(collectionId, itemId, { note });
      const updatedItems = items.map((item) =>
        item.id === itemId ? { ...item, note } : item
      );
      onItemsChange(updatedItems);
      showToast('Note updated', 'success');
    } catch (error) {
      console.error('Failed to update note:', error);
      showToast('Failed to update note', 'error');
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    try {
      await api.removeCollectionItem(collectionId, itemId);
      const updatedItems = items.filter((item) => item.id !== itemId);
      onItemsChange(updatedItems);
      showToast('Item removed', 'info');
    } catch (error) {
      console.error('Failed to remove item:', error);
      showToast('Failed to remove item', 'error');
    }
  };

  // Empty state
  if (items.length === 0) {
    return (
      <div className="py-12 text-center border border-neutral-800 border-dashed">
        <p className="text-sm text-neutral-600 uppercase">
          No items in this collection
        </p>
        {canEdit && (
          <button
            onClick={onAddItem}
            className="mt-4 text-xs px-4 py-2 bg-white text-black font-bold uppercase tracking-wider hover:bg-neutral-200 transition-colors"
          >
            + ADD ITEMS
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={items.map((item) => item.id)}
          strategy={verticalListSortingStrategy}
        >
          {items.map((item) => (
            <SortableItem
              key={item.id}
              item={item}
              collectionId={collectionId}
              canEdit={canEdit}
              onNoteUpdate={handleNoteUpdate}
              onRemove={handleRemoveItem}
            />
          ))}
        </SortableContext>
      </DndContext>

      {/* Add Item Button */}
      {canEdit && (
        <button
          onClick={onAddItem}
          className="w-full py-3 border border-dashed border-neutral-700 text-neutral-500 text-xs font-bold uppercase tracking-wider hover:border-neutral-500 hover:text-white transition-colors"
        >
          + ADD ITEM
        </button>
      )}
    </div>
  );
};

export default CollectionItemList;
