// UnifiedDownloadManager Component - Shows both video and manga downloads
// Allows users to access their downloaded content without WiFi
import React, { useState, useEffect, useCallback } from 'react';
import { useOffline } from '../context/OfflineContext';
import { useOfflineVideo } from '../context/OfflineVideoContext';
import { formatBytes, StorageInfo } from '../services/offlineStorage';
import { VideoStorageInfo, formatBytes as formatVideoBytes } from '../services/offlineVideoStorage';
import { QualityOption } from '../services/hlsDownloader';
import { getProviderDisplayName, MangaProviderName } from '../services/manga';
import { VideoProviderName } from '../types';

// Tab type for filtering content
type ContentTab = 'all' | 'video' | 'manga';

interface UnifiedDownloadManagerProps {
  onMangaClick: (mangaId: string, provider?: MangaProviderName) => void;
  onVideoClick: (mediaId: string, provider: VideoProviderName, title?: string) => void;
}

export const UnifiedDownloadManager: React.FC<UnifiedDownloadManagerProps> = ({
  onMangaClick,
  onVideoClick,
}) => {
  const {
    isOnline,
    downloadedManga,
    downloadQueue: mangaDownloadQueue,
    activeDownload: mangaActiveDownload,
    pauseDownload: pauseMangaDownload,
    resumeDownload: resumeMangaDownload,
    cancelDownload: cancelMangaDownload,
    deleteOfflineManga,
    getStorageInfo: getMangaStorageInfo,
  } = useOffline();

  const {
    downloadedMedia,
    downloadQueue: videoDownloadQueue,
    activeDownload: videoActiveDownload,
    cancelDownload: cancelVideoDownload,
    deleteOfflineMedia,
    getStorageInfo: getVideoStorageInfo,
    selectQuality,
  } = useOfflineVideo();

  const [mangaStorageInfo, setMangaStorageInfo] = useState<StorageInfo | null>(null);
  const [videoStorageInfo, setVideoStorageInfo] = useState<VideoStorageInfo | null>(null);
  const [activeTab, setActiveTab] = useState<ContentTab>('all');
  const [showQueue, setShowQueue] = useState(false);

  // Load storage info on mount and when content changes
  useEffect(() => {
    loadStorageInfo();
  }, [downloadedManga, downloadedMedia]);

  const loadStorageInfo = async () => {
    const [mangaInfo, videoInfo] = await Promise.all([
      getMangaStorageInfo(),
      getVideoStorageInfo(),
    ]);
    setMangaStorageInfo(mangaInfo);
    setVideoStorageInfo(videoInfo);
  };

  const handleDeleteManga = async (mangaId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this manga and all downloaded chapters?')) {
      await deleteOfflineManga(mangaId);
    }
  };

  const handleDeleteVideo = async (mediaId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this video and all downloaded episodes?')) {
      await deleteOfflineMedia(mediaId);
    }
  };

  // Calculate combined storage stats
  const totalStorageUsed = (mangaStorageInfo?.estimatedSize || 0) + (videoStorageInfo?.estimatedSize || 0);
  const storageQuota = mangaStorageInfo?.quota || videoStorageInfo?.quota || null;
  
  // Count active downloads
  const totalQueuedDownloads = 
    (mangaDownloadQueue.length + (mangaActiveDownload ? 1 : 0)) +
    (videoDownloadQueue.length + (videoActiveDownload ? 1 : 0));

  // Get default provider for video (we'll need to track this better)
  const getVideoProvider = (mediaId: string): VideoProviderName => {
    // For now, default to hianime - in a real implementation, store the provider with the media
    return 'hianime';
  };

  const isPaused = mangaActiveDownload?.status === 'paused';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-neutral-800 pb-4 mb-4">
        <h2 className="text-2xl font-bold uppercase tracking-tighter">Downloads</h2>
        <p className="text-sm text-neutral-600 mt-1">
          {isOnline ? 'Manage your offline library' : 'You are offline - showing downloaded content'}
        </p>
        {!isOnline && (
          <div className="mt-2 inline-flex items-center gap-2 px-2 py-1 bg-yellow-900/30 border border-yellow-700/50 text-yellow-500 text-xs">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            Offline Mode
          </div>
        )}
      </div>

      {/* Combined Storage Info */}
      <div className="bg-neutral-950 border border-neutral-800 p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs uppercase tracking-wider text-neutral-600">Total Storage Used</span>
          <span className="text-sm font-mono">
            {formatBytes(totalStorageUsed)}
            {storageQuota && (
              <span className="text-neutral-600"> / {formatBytes(storageQuota)}</span>
            )}
          </span>
        </div>

        {storageQuota && (
          <div className="w-full h-2 bg-neutral-800 overflow-hidden">
            <div
              className="h-full bg-white transition-all"
              style={{
                width: `${Math.min(100, (totalStorageUsed / storageQuota) * 100)}%`,
              }}
            />
          </div>
        )}

        <div className="grid grid-cols-4 gap-4 mt-4 text-center">
          <div>
            <div className="text-2xl font-bold">{downloadedMedia.length}</div>
            <div className="text-xs text-neutral-600 uppercase">Shows</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{videoStorageInfo?.episodeCount || 0}</div>
            <div className="text-xs text-neutral-600 uppercase">Episodes</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{mangaStorageInfo?.mangaCount || 0}</div>
            <div className="text-xs text-neutral-600 uppercase">Manga</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{mangaStorageInfo?.chapterCount || 0}</div>
            <div className="text-xs text-neutral-600 uppercase">Chapters</div>
          </div>
        </div>
      </div>

      {/* Content Type Tabs */}
      <div className="flex border-b border-neutral-800">
        <button
          onClick={() => setActiveTab('all')}
          className={`flex-1 py-3 text-sm uppercase tracking-wider transition-colors ${
            activeTab === 'all'
              ? 'text-white border-b-2 border-white'
              : 'text-neutral-600 hover:text-white'
          }`}
        >
          All ({downloadedMedia.length + downloadedManga.length})
        </button>
        <button
          onClick={() => setActiveTab('video')}
          className={`flex-1 py-3 text-sm uppercase tracking-wider transition-colors ${
            activeTab === 'video'
              ? 'text-white border-b-2 border-white'
              : 'text-neutral-600 hover:text-white'
          }`}
        >
          Video ({downloadedMedia.length})
        </button>
        <button
          onClick={() => setActiveTab('manga')}
          className={`flex-1 py-3 text-sm uppercase tracking-wider transition-colors ${
            activeTab === 'manga'
              ? 'text-white border-b-2 border-white'
              : 'text-neutral-600 hover:text-white'
          }`}
        >
          Manga ({downloadedManga.length})
        </button>
        {totalQueuedDownloads > 0 && (
          <button
            onClick={() => setShowQueue(!showQueue)}
            className={`px-4 py-3 text-sm uppercase tracking-wider transition-colors ${
              showQueue
                ? 'text-white border-b-2 border-white'
                : 'text-neutral-600 hover:text-white'
            }`}
          >
            Queue ({totalQueuedDownloads})
          </button>
        )}
      </div>

      {/* Download Queue Section */}
      {showQueue && totalQueuedDownloads > 0 && (
        <div className="space-y-4 border-b border-neutral-800 pb-6 mb-2">
          <h3 className="text-xs uppercase tracking-wider text-neutral-600">Active Downloads</h3>
          
          {/* Video Active Download */}
          {videoActiveDownload && (
            <div className="bg-neutral-950 border border-neutral-800 p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="text-[10px] px-1.5 py-0.5 bg-blue-900/50 text-blue-400 uppercase tracking-wider mr-2">
                    Video
                  </span>
                  <span className="font-bold uppercase">{videoActiveDownload.mediaTitle}</span>
                  <p className="text-xs text-neutral-600 mt-1">
                    Episode {videoActiveDownload.episode.number}
                    {videoActiveDownload.isHLS && videoActiveDownload.status === 'awaiting_quality' && (
                      <span className="text-yellow-500 ml-2">Select quality below</span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => cancelVideoDownload(videoActiveDownload.episode.id)}
                  className="p-2 text-neutral-500 hover:text-red-500 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Quality Selection for HLS */}
              {videoActiveDownload.status === 'awaiting_quality' && videoActiveDownload.availableQualities && (
                <div className="space-y-2 mb-3">
                  <p className="text-xs text-neutral-500">Select download quality:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {videoActiveDownload.availableQualities.map((quality) => (
                      <button
                        key={quality.label}
                        onClick={() => selectQuality(videoActiveDownload.episode.id, quality)}
                        className="px-3 py-2 text-left border border-neutral-700 hover:border-white transition-colors"
                      >
                        <div className="text-sm font-medium">{quality.label}</div>
                        {(quality as QualityOption & { estimatedSize?: number }).estimatedSize && (
                          <div className="text-xs text-neutral-500">
                            ~{formatVideoBytes((quality as QualityOption & { estimatedSize?: number }).estimatedSize!)}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Progress bar */}
              {videoActiveDownload.status === 'downloading' && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-neutral-500">
                      {videoActiveDownload.isHLS 
                        ? `Segment ${videoActiveDownload.segmentsDownloaded || 0}/${videoActiveDownload.totalSegments || '?'}`
                        : 'Downloading...'}
                    </span>
                    <span className="text-neutral-500">{Math.round(videoActiveDownload.progress)}%</span>
                  </div>
                  <div className="w-full h-1 bg-neutral-800">
                    <div
                      className="h-full bg-white transition-all"
                      style={{ width: `${videoActiveDownload.progress}%` }}
                    />
                  </div>
                  {videoActiveDownload.bytesDownloaded != null && (
                    <div className="text-xs text-neutral-600 text-right">
                      {formatVideoBytes(videoActiveDownload.bytesDownloaded)}
                      {videoActiveDownload.estimatedSize && (
                        <> / {formatVideoBytes(videoActiveDownload.estimatedSize)}</>
                      )}
                    </div>
                  )}
                </div>
              )}

              {videoActiveDownload.status === 'error' && (
                <div className="text-xs text-red-500">{videoActiveDownload.error || 'Download failed'}</div>
              )}
            </div>
          )}

          {/* Manga Active Download */}
          {mangaActiveDownload && (
            <div className="bg-neutral-950 border border-neutral-800 p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="text-[10px] px-1.5 py-0.5 bg-green-900/50 text-green-400 uppercase tracking-wider mr-2">
                    Manga
                  </span>
                  <span className="font-bold uppercase">{mangaActiveDownload.mangaTitle}</span>
                  <p className="text-xs text-neutral-600 mt-1">
                    Downloading {mangaActiveDownload.chapterIds.length} chapters
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => isPaused ? resumeMangaDownload() : pauseMangaDownload()}
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
                    onClick={() => cancelMangaDownload(mangaActiveDownload.mangaId)}
                    className="p-2 text-neutral-500 hover:text-red-500 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Chapter progress bars */}
              <div className="space-y-2">
                {mangaActiveDownload.progress.map((prog, idx) => {
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

          {/* Queued downloads */}
          {(videoDownloadQueue.length > 0 || mangaDownloadQueue.length > 0) && (
            <div className="space-y-2">
              <h4 className="text-xs uppercase tracking-wider text-neutral-700">Queued</h4>
              {videoDownloadQueue.map((task) => (
                <div
                  key={task.episode.id}
                  className="bg-neutral-950 border border-neutral-800 p-3 flex items-center justify-between"
                >
                  <div>
                    <span className="text-[10px] px-1.5 py-0.5 bg-blue-900/50 text-blue-400 uppercase tracking-wider mr-2">
                      Video
                    </span>
                    <span className="font-medium">{task.mediaTitle}</span>
                    <span className="text-xs text-neutral-600 ml-2">
                      Ep {task.episode.number}
                    </span>
                  </div>
                  <button
                    onClick={() => cancelVideoDownload(task.episode.id)}
                    className="p-1 text-neutral-500 hover:text-red-500 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
              {mangaDownloadQueue.map((task) => (
                <div
                  key={task.mangaId}
                  className="bg-neutral-950 border border-neutral-800 p-3 flex items-center justify-between"
                >
                  <div>
                    <span className="text-[10px] px-1.5 py-0.5 bg-green-900/50 text-green-400 uppercase tracking-wider mr-2">
                      Manga
                    </span>
                    <span className="font-medium">{task.mangaTitle}</span>
                    <span className="text-xs text-neutral-600 ml-2">
                      {task.chapterIds.length} chapters
                    </span>
                  </div>
                  <button
                    onClick={() => cancelMangaDownload(task.mangaId)}
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
        </div>
      )}

      {/* Downloaded Content Library */}
      <div className="space-y-2">
        {/* Video Content */}
        {(activeTab === 'all' || activeTab === 'video') && downloadedMedia.length > 0 && (
          <>
            {activeTab === 'all' && downloadedMedia.length > 0 && (
              <h3 className="text-xs uppercase tracking-wider text-neutral-600 mt-4 mb-2">Videos</h3>
            )}
            {downloadedMedia.map((media) => (
              <div
                key={media.id}
                onClick={() => onVideoClick(media.id, getVideoProvider(media.id), media.title)}
                className="bg-neutral-950 border border-neutral-800 p-3 flex items-center gap-3 cursor-pointer hover:border-neutral-600 transition-colors"
              >
                {/* Cover */}
                {media.coverBlob ? (
                  <img
                    src={URL.createObjectURL(media.coverBlob)}
                    alt={media.title}
                    className="w-12 h-16 object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-12 h-16 bg-neutral-800 flex-shrink-0 flex items-center justify-center">
                    <svg className="w-6 h-6 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold uppercase text-sm truncate">{media.title}</h3>
                    <span className="text-[10px] px-1.5 py-0.5 bg-blue-900/50 text-blue-400 uppercase tracking-wider flex-shrink-0">
                      Video
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500">
                    {media.episodeCount} episode{media.episodeCount !== 1 ? 's' : ''} downloaded
                  </p>
                  <p className="text-xs text-neutral-600">
                    Saved {new Date(media.downloadedAt).toLocaleDateString()}
                  </p>
                </div>

                {/* Actions */}
                <button
                  onClick={(e) => handleDeleteVideo(media.id, e)}
                  className="p-2 text-neutral-600 hover:text-red-500 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </>
        )}

        {/* Manga Content */}
        {(activeTab === 'all' || activeTab === 'manga') && downloadedManga.length > 0 && (
          <>
            {activeTab === 'all' && downloadedManga.length > 0 && (
              <h3 className="text-xs uppercase tracking-wider text-neutral-600 mt-4 mb-2">Manga</h3>
            )}
            {downloadedManga.map((manga) => (
              <div
                key={manga.id}
                onClick={() => onMangaClick(manga.id, manga.data.provider)}
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
                  <div className="w-12 h-16 bg-neutral-800 flex-shrink-0 flex items-center justify-center">
                    <svg className="w-6 h-6 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold uppercase text-sm truncate">{manga.data.title}</h3>
                    <span className="text-[10px] px-1.5 py-0.5 bg-green-900/50 text-green-400 uppercase tracking-wider flex-shrink-0">
                      Manga
                    </span>
                    {manga.data.provider && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-neutral-800 text-neutral-400 uppercase tracking-wider flex-shrink-0">
                        {getProviderDisplayName(manga.data.provider)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-500">
                    {manga.chaptersDownloaded} chapter{manga.chaptersDownloaded !== 1 ? 's' : ''} downloaded
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
            ))}
          </>
        )}

        {/* Empty State */}
        {downloadedMedia.length === 0 && downloadedManga.length === 0 && (
          <div className="text-center py-12 text-neutral-600">
            <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <p className="uppercase tracking-wider text-sm">No downloaded content</p>
            <p className="text-xs mt-2 text-neutral-700">
              {isOnline 
                ? 'Download episodes or chapters from detail pages for offline viewing'
                : 'Go online to download content for offline viewing'
              }
            </p>
          </div>
        )}

        {/* Content-specific empty states */}
        {activeTab === 'video' && downloadedMedia.length === 0 && downloadedManga.length > 0 && (
          <div className="text-center py-12 text-neutral-600">
            <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <p className="uppercase tracking-wider text-sm">No downloaded videos</p>
            <p className="text-xs mt-2 text-neutral-700">
              Download episodes from anime/movie detail pages
            </p>
          </div>
        )}

        {activeTab === 'manga' && downloadedManga.length === 0 && downloadedMedia.length > 0 && (
          <div className="text-center py-12 text-neutral-600">
            <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <p className="uppercase tracking-wider text-sm">No downloaded manga</p>
            <p className="text-xs mt-2 text-neutral-700">
              Download chapters from manga detail pages
            </p>
          </div>
        )}
      </div>

      {/* Storage Warning */}
      {storageQuota && totalStorageUsed > storageQuota * 0.8 && (
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
