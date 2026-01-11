import React, { useState, useEffect } from 'react';
import { Collection } from '../types';
import * as api from '../services/api';
import { useToast } from '../context/ToastContext';

interface CollectionFormProps {
  collection?: Collection; // If provided, editing mode
  onClose: () => void;
  onSave: (collection: Collection) => void;
}

export const CollectionForm: React.FC<CollectionFormProps> = ({
  collection,
  onClose,
  onSave,
}) => {
  const { showToast } = useToast();
  const isEditing = !!collection;

  // Form state
  const [title, setTitle] = useState(collection?.title || '');
  const [description, setDescription] = useState(collection?.description || '');
  const [coverUrl, setCoverUrl] = useState(collection?.coverUrl || '');
  const [isPublic, setIsPublic] = useState(collection?.isPublic ?? false);

  // UI state
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ title?: string }>({});

  // Pre-populate form when collection prop changes
  useEffect(() => {
    if (collection) {
      setTitle(collection.title);
      setDescription(collection.description || '');
      setCoverUrl(collection.coverUrl || '');
      setIsPublic(collection.isPublic);
    }
  }, [collection]);

  const validateForm = (): boolean => {
    const newErrors: { title?: string } = {};

    if (!title.trim()) {
      newErrors.title = 'Title is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const data = {
        title: title.trim(),
        description: description.trim() || undefined,
        coverUrl: coverUrl.trim() || undefined,
        isPublic,
      };

      let result: Collection;

      if (isEditing && collection) {
        result = await api.updateCollection(collection.id, data);
        showToast('List updated successfully', 'success');
      } else {
        result = await api.createCollection(data);
        showToast('List created successfully', 'success');
      }

      onSave(result);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Check if cover URL is a valid image URL
  const isValidImageUrl = (url: string): boolean => {
    if (!url.trim()) return false;
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-black border border-neutral-800 w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-800">
          <h2 className="text-lg font-bold uppercase tracking-wider">
            {isEditing ? 'EDIT LIST' : 'CREATE LIST'}
          </h2>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-white transition-colors p-1"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs text-neutral-500 uppercase tracking-wider mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (errors.title) {
                  setErrors((prev) => ({ ...prev, title: undefined }));
                }
              }}
              placeholder="My Awesome List"
              className={`bg-black border ${
                errors.title ? 'border-red-500' : 'border-neutral-800'
              } focus:border-white outline-none p-3 w-full transition-colors`}
            />
            {errors.title && (
              <p className="text-red-500 text-xs mt-1 uppercase">{errors.title}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs text-neutral-500 uppercase tracking-wider mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this list about?"
              rows={3}
              className="bg-black border border-neutral-800 focus:border-white outline-none p-3 w-full resize-none transition-colors"
            />
          </div>

          {/* Cover URL */}
          <div>
            <label className="block text-xs text-neutral-500 uppercase tracking-wider mb-1">
              Cover Image URL
            </label>
            <input
              type="text"
              value={coverUrl}
              onChange={(e) => setCoverUrl(e.target.value)}
              placeholder="https://example.com/image.jpg"
              className="bg-black border border-neutral-800 focus:border-white outline-none p-3 w-full transition-colors"
            />
            {/* Cover Preview */}
            {isValidImageUrl(coverUrl) && (
              <div className="mt-2 border border-neutral-800 p-2">
                <p className="text-xs text-neutral-500 uppercase tracking-wider mb-2">Preview</p>
                <img
                  src={coverUrl}
                  alt="Cover preview"
                  className="w-full h-32 object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                  onLoad={(e) => {
                    (e.target as HTMLImageElement).style.display = 'block';
                  }}
                />
              </div>
            )}
          </div>

          {/* Is Public Toggle */}
          <div className="p-3 border border-neutral-800 bg-neutral-900/50">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="font-bold uppercase text-sm">Public List</p>
                <p className="text-xs text-neutral-500 mt-1">
                  {isPublic
                    ? 'Anyone can view this list'
                    : 'Only you and members can view this list'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsPublic(!isPublic)}
                className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none ${
                  isPublic ? 'bg-green-600' : 'bg-neutral-700'
                }`}
                aria-label={isPublic ? 'Make list private' : 'Make list public'}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-200 ${
                    isPublic ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 border border-neutral-800 text-neutral-400 px-4 py-3 uppercase tracking-wider text-sm font-bold hover:border-neutral-600 hover:text-white transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-white text-black px-4 py-3 uppercase tracking-wider text-sm font-bold hover:bg-neutral-200 transition-colors disabled:opacity-50"
            >
              {loading ? 'Saving...' : isEditing ? 'Save Changes' : 'Create List'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CollectionForm;
