// DownloadManager Component - Shows download queue, progress, and storage info
import React, { useState, useEffect } from 'react';
import { useOffline } from '../context/OfflineContext';
import { formatBytes, StorageInfo } from '../services/offlineStorage';

interface DownloadManagerProps {
  onMangaClick: (mangaId: string) => void;
}

export const DownloadManager: React.FC<DownloadManagerProps> = ({ onMangaClick }) => {
  const {
    isOnline,
    downloadedManga,
    downloadQueue,
    activeDownload,
    pauseDownload,
    resumeDownload,
    cancelDownload,
    deleteOfflineManga,
    getStorageInfo,
    refreshDownloadedContent,
  } = useOffline();

  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<'downloads' | 'library'>('library');

  useEffect(() => {
    loadStorageInfo();
  }, [downloadedManga]);

  const loadStorageInfo = async () => {
    const info = await getStorageInfo();
    setStorageInfo(info);
  };

  const handleDeleteManga = async (mangaId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this manga and all downloaded chapters?')) {
      await deleteOfflineManga(mangaId);
    }
  };

  const isPaused = activeDownload?.status === 'paused';

  return (
    <div className="space-y-6">
      <div className="border-b border-neutral-800 pb-4 mb-4">
        <h2 className="text-2xl font-bold uppercase tracking-tighter">Downloads</h2>
        <p className="text-sm text-neutral-600 mt-1">
          Manage your offline manga library
        </p>
      </div>

      {/* Storage Info */}
      {storageInfo && (
        <div className="bg-neutral-950 border border-neutral-800 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs uppercase tracking-wider text-neutral-600">Storage Used</span>
            <span className="text-sm font-mono">
              {formatBytes(storageInfo.estimatedSize)}
              {storageInfo.quota && (
                <span className="text-neutral-600"> / {formatBytes(storageInfo.quota)}</span>
              )}
            </span>
          </div>

          {storageInfo.quota && (
            <div className="w-full h-2 bg-neutral-800 overflow-hidden">
              <div
                className="h-full bg-white transition-all"
                style={{
                  width: `${Math.min(100, (storageInfo.estimatedSize / storageInfo.quota) * 100)}%`,
                }}
              />
            </div>
          )}

          <div className="grid grid-cols-3 gap-4 mt-4 text-center">
            <div>
              <div className="text-2xl font-bold">{storageInfo.mangaCount}</div>
              <div className="text-xs text-neutral-600 uppercase">Manga</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{storageInfo.chapterCount}</div>
              <div className="text-xs text-neutral-600 uppercase">Chapters</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{storageInfo.pageCount}</div>
              <div className="text-xs text-neutral-600 uppercase">Pages</div>
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
          Library ({downloadedManga.length})
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
              <h3 className="font-bold uppercase">{activeDownload.mangaTitle}</h3>
              <p className="text-xs text-neutral-600">
                Downloading {activeDownload.chapterIds.length} chapters
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => isPaused ? resumeDownload() : pauseDownload()}
                className="p-2 text-neutral-500 hover:text-white transition-colors"
              >
                {isPaused ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
              <button
                onClick={() => cancelDownload(activeDownload.mangaId)}
                className="p-2 text-neutral-500 hover:text-red-500 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Progress bars for each chapter */}
          <div className="space-y-2">
            {activeDownload.progress.map((prog, idx) => {
              const percent = prog.totalPages > 0 
                ? Math.round((prog.currentPage / prog.totalPages) * 100)
                : 0;

              return (
                <div key={prog.chapterId} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-neutral-500">
                      Chapter {idx + 1}
                      {prog.status === 'error' && (
                        <span className="text-red-500 ml-2">Failed</span>
                      )}
                    </span>
                    <span className={
                      prog.status === 'completed' ? 'text-green-500' :
                      prog.status === 'error' ? 'text-red-500' :
                      'text-neutral-500'
                    }>
                      {prog.status === 'completed' ? 'Done' :
                       prog.status === 'error' ? 'Error' :
                       prog.status === 'downloading' ? `${percent}%` : 'Pending'}
                    </span>
                  </div>
                  <div className="w-full h-1 bg-neutral-800">
                    <div
                      className={`h-full transition-all ${
                        prog.status === 'completed' ? 'bg-green-500' :
                        prog.status === 'error' ? 'bg-red-500' :
                        'bg-white'
                      }`}
                      style={{ width: `${prog.status === 'completed' ? 100 : percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Download Queue */}
      {activeTab === 'downloads' && downloadQueue.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs uppercase tracking-wider text-neutral-600">Queued</h3>
          {downloadQueue.map((task, idx) => (
            <div
              key={task.mangaId}
              className="bg-neutral-950 border border-neutral-800 p-3 flex items-center justify-between"
            >
              <div>
                <span className="font-medium">{task.mangaTitle}</span>
                <span className="text-xs text-neutral-600 ml-2">
                  {task.chapterIds.length} chapters
                </span>
              </div>
              <button
                onClick={() => cancelDownload(task.mangaId)}
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
            Download chapters from manga detail pages
          </p>
        </div>
      )}

      {/* Downloaded Manga Library */}
      {activeTab === 'library' && (
        <div className="space-y-2">
          {downloadedManga.length === 0 ? (
            <div className="text-center py-12 text-neutral-600">
              <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <p className="uppercase tracking-wider text-sm">No offline manga</p>
              <p className="text-xs mt-2 text-neutral-700">
                {isOnline 
                  ? 'Search for manga and download chapters for offline reading'
                  : 'Go online to download manga'
                }
              </p>
            </div>
          ) : (
            downloadedManga.map((manga) => (
              <div
                key={manga.id}
                onClick={() => onMangaClick(manga.id)}
                className="bg-neutral-950 border border-neutral-800 p-3 flex items-center gap-3 cursor-pointer hover:border-neutral-600 transition-colors"
              >
                {/* Cover */}
                {manga.coverBlob ? (
                  <img
                    src={URL.createObjectURL(manga.coverBlob)}
                    alt={manga.data.title}
                    className="w-12 h-16 object-cover flex-shrink-0"
                  />
                ) : manga.data.coverUrlSmall ? (
                  <img
                    src={manga.data.coverUrlSmall}
                    alt={manga.data.title}
                    className="w-12 h-16 object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-12 h-16 bg-neutral-800 flex-shrink-0" />
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold uppercase text-sm truncate">{manga.data.title}</h3>
                  <p className="text-xs text-neutral-500">
                    {manga.chaptersDownloaded} chapters downloaded
                  </p>
                  <p className="text-xs text-neutral-600">
                    Saved {new Date(manga.downloadedAt).toLocaleDateString()}
                  </p>
                </div>

                {/* Actions */}
                <button
                  onClick={(e) => handleDeleteManga(manga.id, e)}
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

      {/* Storage Warning */}
      {storageInfo && storageInfo.quota && 
       storageInfo.estimatedSize > storageInfo.quota * 0.8 && (
        <div className="bg-yellow-900/20 border border-yellow-700/50 p-4 text-yellow-500 text-sm">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="font-bold uppercase text-xs tracking-wider mb-1">Storage Almost Full</p>
              <p className="text-yellow-400/70 text-xs">
                You've used over 80% of your available storage. Consider deleting some downloaded content.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
