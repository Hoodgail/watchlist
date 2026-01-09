// VideoDownloadManager Component - Shows video download queue, progress, and storage info
import React, { useState, useEffect } from 'react';
import { useOfflineVideo } from '../context/OfflineVideoContext';
import { formatBytes, VideoStorageInfo, requestPersistentStorage } from '../services/offlineVideoStorage';

interface VideoDownloadManagerProps {
  onMediaClick?: (mediaId: string) => void;
}

export const VideoDownloadManager: React.FC<VideoDownloadManagerProps> = ({ onMediaClick }) => {
  const {
    isOnline,
    downloadedMedia,
    downloadQueue,
    activeDownload,
    cancelDownload,
    deleteOfflineMedia,
    deleteOfflineEpisode,
    getStorageInfo,
  } = useOfflineVideo();

  const [storageInfo, setStorageInfo] = useState<VideoStorageInfo | null>(null);
  const [activeTab, setActiveTab] = useState<'downloads' | 'library'>('library');
  const [isRequestingPersistence, setIsRequestingPersistence] = useState(false);

  useEffect(() => {
    loadStorageInfo();
  }, [downloadedMedia]);

  const loadStorageInfo = async () => {
    const info = await getStorageInfo();
    setStorageInfo(info);
  };

  const handleRequestPersistence = async () => {
    setIsRequestingPersistence(true);
    try {
      const granted = await requestPersistentStorage();
      if (granted) {
        await loadStorageInfo();
      }
    } finally {
      setIsRequestingPersistence(false);
    }
  };

  const handleDeleteMedia = async (mediaId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this media and all downloaded episodes?')) {
      await deleteOfflineMedia(mediaId);
    }
  };

  // Calculate storage percentage
  const storagePercentage = storageInfo?.quota && storageInfo?.usage
    ? (storageInfo.usage / storageInfo.quota) * 100
    : storageInfo?.quota && storageInfo?.estimatedSize
    ? (storageInfo.estimatedSize / storageInfo.quota) * 100
    : 0;

  const isStorageWarning = storagePercentage >= 80;

  return (
    <div className="space-y-6">
      <div className="border-b border-neutral-800 pb-4 mb-4">
        <h2 className="text-2xl font-bold uppercase tracking-tighter">Video Downloads</h2>
        <p className="text-sm text-neutral-600 mt-1">
          Manage your offline video library
        </p>
      </div>

      {/* Storage Info with Quota Bar */}
      {storageInfo && (
        <div className="bg-neutral-950 border border-neutral-800 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs uppercase tracking-wider text-neutral-600">Storage Used</span>
            <span className="text-sm font-mono">
              {storageInfo.usage 
                ? formatBytes(storageInfo.usage)
                : formatBytes(storageInfo.estimatedSize)
              }
              {storageInfo.quota && (
                <span className="text-neutral-600"> / {formatBytes(storageInfo.quota)}</span>
              )}
            </span>
          </div>

          {/* Storage Progress Bar */}
          {storageInfo.quota && (
            <div className="w-full h-2 bg-neutral-800 overflow-hidden">
              <div
                className={`h-full transition-all ${
                  isStorageWarning ? 'bg-yellow-500' : 'bg-white'
                }`}
                style={{
                  width: `${Math.min(100, storagePercentage)}%`,
                }}
              />
            </div>
          )}

          {/* Storage Stats */}
          <div className="grid grid-cols-3 gap-4 mt-4 text-center">
            <div>
              <div className="text-2xl font-bold">{storageInfo.mediaCount}</div>
              <div className="text-xs text-neutral-600 uppercase">Shows</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{storageInfo.episodeCount}</div>
              <div className="text-xs text-neutral-600 uppercase">Episodes</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{formatBytes(storageInfo.totalBlobSize)}</div>
              <div className="text-xs text-neutral-600 uppercase">Video Data</div>
            </div>
          </div>

          {/* Persistence Status */}
          <div className="mt-4 pt-4 border-t border-neutral-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  storageInfo.isPersisted ? 'bg-green-500' : 'bg-yellow-500'
                }`} />
                <span className="text-xs text-neutral-500">
                  {storageInfo.isPersisted 
                    ? 'Storage is persistent - data will not be evicted'
                    : 'Storage may be cleared by browser'
                  }
                </span>
              </div>
              {!storageInfo.isPersisted && (
                <button
                  onClick={handleRequestPersistence}
                  disabled={isRequestingPersistence}
                  className="text-xs text-white hover:text-neutral-300 transition-colors disabled:opacity-50"
                >
                  {isRequestingPersistence ? 'Requesting...' : 'Request Persistence'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Storage Warning Banner */}
      {storageInfo && isStorageWarning && (
        <div className="bg-yellow-900/20 border border-yellow-700/50 p-4 text-yellow-500 text-sm">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="font-bold uppercase text-xs tracking-wider mb-1">Storage Almost Full</p>
              <p className="text-yellow-400/70 text-xs">
                You've used over 80% of your available storage ({Math.round(storagePercentage)}%). 
                Consider deleting some downloaded content to free up space.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-neutral-800">
        <button
          onClick={() => setActiveTab('library')}
          className={`flex-1 py-3 text-sm uppercase tracking-wider transition-colors ${
            activeTab === 'library'
              ? 'text-white border-b-2 border-white'
              : 'text-neutral-600 hover:text-white'
          }`}
        >
          Library ({downloadedMedia.length})
        </button>
        <button
          onClick={() => setActiveTab('downloads')}
          className={`flex-1 py-3 text-sm uppercase tracking-wider transition-colors ${
            activeTab === 'downloads'
              ? 'text-white border-b-2 border-white'
              : 'text-neutral-600 hover:text-white'
          }`}
        >
          Queue ({downloadQueue.length + (activeDownload ? 1 : 0)})
        </button>
      </div>

      {/* Active Download */}
      {activeTab === 'downloads' && activeDownload && (
        <div className="bg-neutral-950 border border-neutral-800 p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-bold uppercase">{activeDownload.mediaTitle}</h3>
              <p className="text-xs text-neutral-600">
                Episode {activeDownload.episode.number}
                {activeDownload.episode.title && ` - ${activeDownload.episode.title}`}
              </p>
            </div>
            <button
              onClick={() => cancelDownload(activeDownload.episode.id)}
              className="p-2 text-neutral-500 hover:text-red-500 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-neutral-500">
                {activeDownload.status === 'error' ? (
                  <span className="text-red-500">Failed: {activeDownload.error}</span>
                ) : (
                  'Downloading...'
                )}
              </span>
              <span className={
                activeDownload.status === 'error' ? 'text-red-500' : 'text-neutral-500'
              }>
                {activeDownload.progress}%
              </span>
            </div>
            <div className="w-full h-1 bg-neutral-800">
              <div
                className={`h-full transition-all ${
                  activeDownload.status === 'error' ? 'bg-red-500' : 'bg-white'
                }`}
                style={{ width: `${activeDownload.progress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Download Queue */}
      {activeTab === 'downloads' && downloadQueue.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs uppercase tracking-wider text-neutral-600">Queued</h3>
          {downloadQueue.map((task) => (
            <div
              key={task.episode.id}
              className="bg-neutral-950 border border-neutral-800 p-3 flex items-center justify-between"
            >
              <div>
                <span className="font-medium">{task.mediaTitle}</span>
                <span className="text-xs text-neutral-600 ml-2">
                  Episode {task.episode.number}
                </span>
              </div>
              <button
                onClick={() => cancelDownload(task.episode.id)}
                className="p-1 text-neutral-500 hover:text-red-500 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Empty Queue State */}
      {activeTab === 'downloads' && !activeDownload && downloadQueue.length === 0 && (
        <div className="text-center py-12 text-neutral-600">
          <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          <p className="uppercase tracking-wider text-sm">No active downloads</p>
          <p className="text-xs mt-2 text-neutral-700">
            Download episodes from video detail pages
          </p>
        </div>
      )}

      {/* Downloaded Media Library */}
      {activeTab === 'library' && (
        <div className="space-y-2">
          {downloadedMedia.length === 0 ? (
            <div className="text-center py-12 text-neutral-600">
              <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <p className="uppercase tracking-wider text-sm">No offline videos</p>
              <p className="text-xs mt-2 text-neutral-700">
                {isOnline 
                  ? 'Search for shows and download episodes for offline viewing'
                  : 'Go online to download videos'
                }
              </p>
            </div>
          ) : (
            downloadedMedia.map((media) => (
              <div
                key={media.id}
                onClick={() => onMediaClick?.(media.id)}
                className="bg-neutral-950 border border-neutral-800 p-3 flex items-center gap-3 cursor-pointer hover:border-neutral-600 transition-colors"
              >
                {/* Cover */}
                {media.coverBlob ? (
                  <img
                    src={URL.createObjectURL(media.coverBlob)}
                    alt={media.title}
                    className="w-16 h-10 object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-16 h-10 bg-neutral-800 flex-shrink-0 flex items-center justify-center">
                    <svg className="w-6 h-6 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold uppercase text-sm truncate">{media.title}</h3>
                  <p className="text-xs text-neutral-500">
                    {media.episodeCount} episode{media.episodeCount !== 1 ? 's' : ''} downloaded
                  </p>
                  <p className="text-xs text-neutral-600">
                    Last accessed {new Date(media.lastAccessedAt).toLocaleDateString()}
                  </p>
                </div>

                {/* Delete Button */}
                <button
                  onClick={(e) => handleDeleteMedia(media.id, e)}
                  className="p-2 text-neutral-600 hover:text-red-500 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
