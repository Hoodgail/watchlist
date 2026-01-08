// MangaDetail Component - Shows manga details and chapter list
import React, { useState, useEffect, useCallback } from 'react';
import { MangaDetails, ChapterInfo, VolumeWithChapters } from '../services/mangadexTypes';
import * as mangaService from '../services/manga';
import { MangaProviderName, MangaChapter } from '../services/manga';
import { isMangaPlusUrl } from '../services/mangaplus';
import { useOffline } from '../context/OfflineContext';
import { useToast } from '../context/ToastContext';

interface MangaDetailProps {
  mangaId: string;
  onClose: () => void;
  onReadChapter: (mangaId: string, chapterId: string) => void;
  provider?: MangaProviderName;
}

// Helper to proxy image URLs through our server to bypass hotlink protection
function proxyImageUrl(url: string | null): string | null {
  if (!url) return null;
  // Don't proxy blob URLs or already-proxied URLs
  if (url.startsWith('blob:') || url.startsWith('/api/')) {
    return url;
  }
  return `/api/proxy/image?url=${encodeURIComponent(url)}`;
}

export const MangaDetail: React.FC<MangaDetailProps> = ({
  mangaId,
  onClose,
  onReadChapter,
  provider = 'mangadex',
}) => {
  const { showToast } = useToast();
  const {
    isOnline,
    downloadManga,
    downloadChapters,
    isMangaDownloaded,
    isChapterDownloaded,
    deleteOfflineManga,
    deleteOfflineChapter,
    getReadingProgress,
    downloadedManga,
    activeDownload,
  } = useOffline();

  const [manga, setManga] = useState<MangaDetails | null>(null);
  const [volumes, setVolumes] = useState<VolumeWithChapters[]>([]);
  const [allChapters, setAllChapters] = useState<ChapterInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [chaptersLoading, setChaptersLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedVolumes, setExpandedVolumes] = useState<Set<string>>(new Set());
  const [selectedChapters, setSelectedChapters] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [downloadingAll, setDownloadingAll] = useState(false);

  // Load manga details
  useEffect(() => {
    loadMangaDetails();
  }, [mangaId, provider]);

  const loadMangaDetails = async () => {
    setLoading(true);
    setError(null);

    try {
      // Try to load from offline storage first
      const offlineManga = downloadedManga.find(m => m.id === mangaId);
      
      if (offlineManga) {
        setManga(offlineManga.data);
        setLoading(false);
      }

      // If online, fetch fresh data
      if (isOnline) {
        // Use unified manga service for all providers
        const mangaInfo = await mangaService.getMangaInfo(mangaId, provider);
        
        // Convert to MangaDetails format for UI compatibility
        const mangaData: MangaDetails = {
          id: mangaInfo.id,
          title: mangaInfo.title,
          altTitles: mangaInfo.altTitles || [],
          description: mangaInfo.description || '',
          coverUrl: mangaInfo.cover || mangaInfo.image || null,
          coverUrlSmall: mangaInfo.image || mangaInfo.cover || null,
          author: null, // Not available in unified API
          artist: null,
          status: (mangaInfo.status?.toLowerCase() as any) || 'ongoing',
          year: mangaInfo.year || (typeof mangaInfo.releaseDate === 'number' ? mangaInfo.releaseDate : null),
          contentRating: 'safe',
          tags: (mangaInfo.genres || []).map((g, i) => ({ id: String(i), name: g, group: 'genre' })),
          originalLanguage: 'en',
          availableLanguages: ['en'],
          lastChapter: mangaInfo.totalChapters ? String(mangaInfo.totalChapters) : null,
          lastVolume: null,
          demographic: null,
          provider: provider,
        };

        setManga(mangaData);
        
        // Load chapters
        loadChapters();
      } else if (!offlineManga) {
        setError('This manga is not available offline');
      }
    } catch (err) {
      console.error('Failed to load manga:', err);
      setError('Failed to load manga details');
    } finally {
      setLoading(false);
    }
  };

  const loadChapters = async () => {
    setChaptersLoading(true);

    try {
      // Use unified manga service for all providers
      const mangaInfo = await mangaService.getMangaInfo(mangaId, provider);
      const chapters = mangaInfo.chapters || [];
      
      // Convert MangaChapter to ChapterInfo format
      const chaptersData: ChapterInfo[] = chapters.map(ch => ({
        id: ch.id,
        title: ch.title || null,
        volume: ch.volume || null,
        chapter: String(ch.number),
        pages: ch.pages || 0,
        translatedLanguage: 'en',
        scanlationGroup: null,
        publishedAt: ch.releaseDate || new Date().toISOString(),
        externalUrl: ch.url || null,
      }));

      // Group chapters by volume (or "No Volume" if none)
      const volumeMap = new Map<string, ChapterInfo[]>();
      chaptersData.forEach(ch => {
        const vol = ch.volume || 'No Volume';
        if (!volumeMap.has(vol)) {
          volumeMap.set(vol, []);
        }
        volumeMap.get(vol)!.push(ch);
      });

      const volumeData: VolumeWithChapters[] = Array.from(volumeMap.entries())
        .map(([volume, chapters]) => ({ volume, chapters }))
        .sort((a, b) => {
          if (a.volume === 'No Volume') return 1;
          if (b.volume === 'No Volume') return -1;
          return parseFloat(a.volume) - parseFloat(b.volume);
        });

      setVolumes(volumeData);
      setAllChapters(chaptersData);

      // Expand first volume by default
      if (volumeData.length > 0) {
        setExpandedVolumes(new Set([volumeData[0].volume]));
      }
    } catch (err) {
      console.error('Failed to load chapters:', err);
    } finally {
      setChaptersLoading(false);
    }
  };

  const toggleVolume = (volume: string) => {
    setExpandedVolumes(prev => {
      const next = new Set(prev);
      if (next.has(volume)) {
        next.delete(volume);
      } else {
        next.add(volume);
      }
      return next;
    });
  };

  const toggleChapterSelection = (chapterId: string) => {
    setSelectedChapters(prev => {
      const next = new Set(prev);
      if (next.has(chapterId)) {
        next.delete(chapterId);
      } else {
        next.add(chapterId);
      }
      return next;
    });
  };

  const selectAllInVolume = (volume: VolumeWithChapters) => {
    setSelectedChapters(prev => {
      const next = new Set(prev);
      volume.chapters.forEach(ch => next.add(ch.id));
      return next;
    });
  };

  const deselectAllInVolume = (volume: VolumeWithChapters) => {
    setSelectedChapters(prev => {
      const next = new Set(prev);
      volume.chapters.forEach(ch => next.delete(ch.id));
      return next;
    });
  };

  const handleDownloadManga = async () => {
    if (!manga) return;

    try {
      await downloadManga(manga, provider);
      showToast('Manga saved for offline reading', 'success');
    } catch (err) {
      showToast('Failed to save manga', 'error');
    }
  };

  const handleDownloadSelected = async () => {
    if (!manga || selectedChapters.size === 0) return;

    const chaptersToDownload = allChapters.filter(ch => selectedChapters.has(ch.id));
    
    try {
      await downloadChapters(mangaId, manga.title, chaptersToDownload, provider);
      showToast(`Downloading ${chaptersToDownload.length} chapters...`, 'success');
      setSelectedChapters(new Set());
      setIsSelectionMode(false);
    } catch (err) {
      showToast('Failed to start download', 'error');
    }
  };

  const handleDownloadAll = async () => {
    if (!manga || allChapters.length === 0) return;

    setDownloadingAll(true);
    try {
      await downloadManga(manga, provider);
      await downloadChapters(mangaId, manga.title, allChapters, provider);
      showToast(`Downloading all ${allChapters.length} chapters...`, 'success');
    } catch (err) {
      showToast('Failed to start download', 'error');
    } finally {
      setDownloadingAll(false);
    }
  };

  const handleDeleteManga = async () => {
    if (!confirm('Delete this manga and all downloaded chapters?')) return;

    try {
      await deleteOfflineManga(mangaId);
      showToast('Manga deleted from offline storage', 'success');
    } catch (err) {
      showToast('Failed to delete manga', 'error');
    }
  };

  const handleDeleteChapter = async (chapterId: string) => {
    try {
      await deleteOfflineChapter(chapterId);
      showToast('Chapter deleted', 'success');
    } catch (err) {
      showToast('Failed to delete chapter', 'error');
    }
  };

  const readingProgress = getReadingProgress(mangaId);

  const getChapterForId = (chapterId: string): ChapterInfo | undefined => {
    return allChapters.find(ch => ch.id === chapterId);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
        <div className="text-neutral-600 uppercase tracking-wider text-sm animate-pulse">
          Loading manga...
        </div>
      </div>
    );
  }

  if (error || !manga) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center gap-4">
        <div className="text-red-500 uppercase tracking-wider text-sm">{error || 'Manga not found'}</div>
        <button
          onClick={onClose}
          className="px-4 py-2 border border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-white transition-colors text-xs uppercase tracking-wider"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-black/95 backdrop-blur-sm border-b border-neutral-800 p-4">
        <div className="flex items-center justify-between">
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-white flex items-center gap-2 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-xs uppercase tracking-wider">Back</span>
          </button>
          
          {!isOnline && (
            <div className="flex items-center gap-2 text-red-500 text-xs uppercase tracking-wider">
              <div className="w-2 h-2 bg-red-500 rounded-full" />
              Offline
            </div>
          )}
        </div>
      </div>

      {/* Manga Info */}
      <div className="p-4 border-b border-neutral-800">
        <div className="flex gap-4">
          {/* Cover */}
          <div className="flex-shrink-0 w-32">
            {manga.coverUrlSmall ? (
              <img
                src={proxyImageUrl(manga.coverUrlSmall) || ''}
                alt={manga.title}
                className="w-full aspect-[2/3] object-cover bg-neutral-900 border border-neutral-800"
              />
            ) : (
              <div className="w-full aspect-[2/3] bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-700 text-xs uppercase">
                No Cover
              </div>
            )}
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold uppercase tracking-tight text-white mb-2 line-clamp-2">
              {manga.title}
            </h1>

            {manga.author && (
              <p className="text-sm text-neutral-500 mb-1">
                By <span className="text-neutral-300">{manga.author}</span>
                {manga.artist && manga.artist !== manga.author && (
                  <>, Art by <span className="text-neutral-300">{manga.artist}</span></>
                )}
              </p>
            )}

            <div className="flex flex-wrap gap-2 mt-2">
              <span className={`px-2 py-0.5 text-xs uppercase border ${
                manga.status === 'completed' ? 'border-green-700 text-green-500' :
                manga.status === 'ongoing' ? 'border-blue-700 text-blue-400' :
                'border-neutral-800 text-neutral-500'
              }`}>
                {manga.status}
              </span>
              
              {manga.year && (
                <span className="px-2 py-0.5 text-xs border border-neutral-800 text-neutral-500">
                  {manga.year}
                </span>
              )}
              
              {manga.demographic && (
                <span className="px-2 py-0.5 text-xs border border-neutral-800 text-neutral-500 uppercase">
                  {manga.demographic}
                </span>
              )}
              
              {provider && (
                <span className="px-2 py-0.5 text-xs border border-neutral-700 text-neutral-400 uppercase">
                  {mangaService.getProviderDisplayName(provider)}
                </span>
              )}
            </div>

            {manga.statistics && (
              <div className="flex gap-4 mt-3 text-sm">
                {manga.statistics.rating.average && (
                  <div className="flex items-center gap-1 text-neutral-300">
                    <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    <span>{manga.statistics.rating.average.toFixed(1)}</span>
                  </div>
                )}
                <div className="flex items-center gap-1 text-neutral-500">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  <span>{manga.statistics.follows.toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        {manga.description && (
          <div className="mt-4">
            <p className="text-sm text-neutral-500 line-clamp-4">{manga.description}</p>
          </div>
        )}

        {/* Tags */}
        {manga.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-4">
            {manga.tags.slice(0, 10).map(tag => (
              <span
                key={tag.id}
                className="px-2 py-0.5 text-xs bg-neutral-950 text-neutral-600 border border-neutral-800"
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 mt-4">
          {isMangaDownloaded(mangaId) ? (
            <button
              onClick={handleDeleteManga}
              className="px-4 py-2 text-xs uppercase tracking-wider border border-red-900 text-red-500 hover:bg-red-900/20 transition-colors"
            >
              Delete Offline
            </button>
          ) : (
            <button
              onClick={handleDownloadManga}
              disabled={!isOnline}
              className="px-4 py-2 text-xs uppercase tracking-wider border border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Save Offline
            </button>
          )}
          
          {isOnline && allChapters.length > 0 && (
            <button
              onClick={handleDownloadAll}
              disabled={downloadingAll}
              className="px-4 py-2 text-xs uppercase tracking-wider bg-white text-black hover:bg-neutral-200 disabled:opacity-50 transition-colors"
            >
              {downloadingAll ? 'Starting...' : `Download All (${allChapters.length})`}
            </button>
          )}

          {readingProgress && (
            <button
              onClick={() => onReadChapter(mangaId, readingProgress.chapterId)}
              className="px-4 py-2 text-xs uppercase tracking-wider border border-white text-white hover:bg-white hover:text-black transition-colors"
            >
              Continue Ch. {getChapterForId(readingProgress.chapterId)?.chapter || '?'}
            </button>
          )}
        </div>
      </div>

      {/* Download Progress */}
      {activeDownload && activeDownload.mangaId === mangaId && (
        <div className="mx-4 mb-4 bg-neutral-950 border border-neutral-800 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs uppercase tracking-wider text-neutral-500">
              Downloading {activeDownload.chapterIds.length} chapters
            </span>
            <span className="text-xs text-neutral-400">
              {activeDownload.progress.filter(p => p.status === 'completed').length} / {activeDownload.chapterIds.length}
            </span>
          </div>
          
          {/* Overall progress bar */}
          <div className="w-full h-2 bg-neutral-800 mb-3">
            <div
              className="h-full bg-white transition-all"
              style={{
                width: `${(activeDownload.progress.filter(p => p.status === 'completed').length / activeDownload.chapterIds.length) * 100}%`,
              }}
            />
          </div>
          
          {/* Current chapter progress */}
          {activeDownload.progress.map((prog, idx) => {
            if (prog.status !== 'downloading') return null;
            const percent = prog.totalPages > 0 
              ? Math.round((prog.currentPage / prog.totalPages) * 100)
              : 0;
            return (
              <div key={prog.chapterId} className="text-xs text-neutral-400">
                Chapter {idx + 1}: {prog.currentPage}/{prog.totalPages} pages ({percent}%)
              </div>
            );
          })}
        </div>
      )}

      {/* Chapters */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-4 border-b border-neutral-900 pb-2">
          <h2 className="text-sm font-bold text-neutral-500 uppercase tracking-widest">
            Chapters {allChapters.length > 0 && `(${allChapters.length})`}
          </h2>
          
          {allChapters.length > 0 && (
            <button
              onClick={() => {
                setIsSelectionMode(!isSelectionMode);
                if (isSelectionMode) setSelectedChapters(new Set());
              }}
              className="text-xs uppercase tracking-wider text-neutral-500 hover:text-white transition-colors"
            >
              {isSelectionMode ? 'Cancel' : 'Select'}
            </button>
          )}
        </div>

        {isSelectionMode && selectedChapters.size > 0 && (
          <div className="sticky top-16 z-30 bg-neutral-950 border border-neutral-800 p-3 mb-4 flex items-center justify-between">
            <span className="text-sm text-neutral-400">{selectedChapters.size} selected</span>
            <button
              onClick={handleDownloadSelected}
              className="px-4 py-1 text-xs uppercase tracking-wider bg-white text-black hover:bg-neutral-200 transition-colors"
            >
              Download Selected
            </button>
          </div>
        )}

        {chaptersLoading ? (
          <div className="text-neutral-600 text-center py-8 text-sm uppercase tracking-wider animate-pulse">
            Loading chapters...
          </div>
        ) : volumes.length === 0 ? (
          <div className="text-neutral-600 text-center py-8 text-sm uppercase tracking-wider">
            No chapters available
          </div>
        ) : (
          <div className="space-y-2">
            {volumes.map(volume => {
              const isExpanded = expandedVolumes.has(volume.volume);
              const allDownloaded = volume.chapters.every(ch => isChapterDownloaded(ch.id));
              const someDownloaded = volume.chapters.some(ch => isChapterDownloaded(ch.id));
              
              return (
                <div key={volume.volume} className="border border-neutral-800">
                  {/* Volume Header */}
                  <button
                    onClick={() => toggleVolume(volume.volume)}
                    className="w-full px-4 py-3 flex items-center justify-between bg-neutral-950 hover:bg-neutral-900 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-bold uppercase tracking-tight text-white">
                        {volume.volume === 'No Volume' ? 'Chapters' : `Volume ${volume.volume}`}
                      </span>
                      <span className="text-sm text-neutral-600">
                        {volume.chapters.length} chapters
                      </span>
                      {allDownloaded && (
                        <span className="text-xs text-green-500 uppercase">All Offline</span>
                      )}
                      {someDownloaded && !allDownloaded && (
                        <span className="text-xs text-yellow-600 uppercase">Partial</span>
                      )}
                    </div>
                    <svg
                      className={`w-4 h-4 text-neutral-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Chapter List */}
                  {isExpanded && (
                    <div className="divide-y divide-neutral-800">
                      {isSelectionMode && (
                        <div className="px-4 py-2 bg-black flex gap-4">
                          <button
                            onClick={() => selectAllInVolume(volume)}
                            className="text-xs text-neutral-500 hover:text-white transition-colors"
                          >
                            Select All
                          </button>
                          <button
                            onClick={() => deselectAllInVolume(volume)}
                            className="text-xs text-neutral-500 hover:text-white transition-colors"
                          >
                            Deselect All
                          </button>
                        </div>
                      )}
                      
                      {volume.chapters.map(chapter => {
                        const downloaded = isChapterDownloaded(chapter.id);
                        const fullChapter = allChapters.find(c => c.id === chapter.id);
                        const isSelected = selectedChapters.has(chapter.id);
                        const hasExternalUrl = !!fullChapter?.externalUrl;
                        const isMangaPlus = isMangaPlusUrl(fullChapter?.externalUrl || null);
                        const isUnavailable = fullChapter?.isUnavailable && !hasExternalUrl;
                        const canRead = !isUnavailable || downloaded;
                        
                        // Check if this chapter is currently downloading
                        const downloadProgress = activeDownload?.mangaId === mangaId 
                          ? activeDownload.progress.find(p => p.chapterId === chapter.id)
                          : null;
                        const isDownloading = downloadProgress?.status === 'downloading';
                        const downloadPercent = downloadProgress && downloadProgress.totalPages > 0
                          ? Math.round((downloadProgress.currentPage / downloadProgress.totalPages) * 100)
                          : 0;
                        
                        return (
                          <div
                            key={chapter.id}
                            className={`px-4 py-3 flex items-center justify-between transition-colors ${
                              isSelected ? 'bg-neutral-900' : 'bg-black'
                            } ${isUnavailable ? 'opacity-50' : 'hover:bg-neutral-900'}`}
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              {isSelectionMode && (
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleChapterSelection(chapter.id)}
                                  className="w-4 h-4 bg-neutral-800 border-neutral-700"
                                  disabled={isUnavailable}
                                />
                              )}
                              
                              <button
                                onClick={() => {
                                  if (isSelectionMode) {
                                    toggleChapterSelection(chapter.id);
                                  } else if (canRead) {
                                    onReadChapter(mangaId, chapter.id);
                                  }
                                }}
                                disabled={!canRead && !isSelectionMode}
                                className={`flex-1 text-left min-w-0 ${!canRead ? 'cursor-not-allowed' : ''}`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className={`font-medium ${isUnavailable ? 'text-neutral-500' : 'text-white'}`}>
                                    Ch. {chapter.chapter || '?'}
                                  </span>
                                  {fullChapter?.title && (
                                    <span className="text-neutral-500 truncate">
                                      - {fullChapter.title}
                                    </span>
                                  )}
                                </div>
                                {fullChapter && (
                                  <div className="text-xs text-neutral-600 mt-1 flex items-center gap-2">
                                    {fullChapter.scanlationGroup && (
                                      <span>{fullChapter.scanlationGroup}</span>
                                    )}
                                    {hasExternalUrl ? (
                                      isMangaPlus ? (
                                        <span className="text-orange-500">MangaPlus</span>
                                      ) : (
                                        <span className="text-yellow-600">External</span>
                                      )
                                    ) : (
                                      <span>{fullChapter.pages} pages</span>
                                    )}
                                    {isUnavailable && (
                                      <span className="text-red-500">Unavailable</span>
                                    )}
                                  </div>
                                )}
                              </button>
                            </div>

                            <div className="flex items-center gap-2">
                              {downloaded && !isDownloading && (
                                <span className="text-xs text-green-500 uppercase">Offline</span>
                              )}
                              {isDownloading && (
                                <div className="flex items-center gap-1.5">
                                  <svg className="w-3.5 h-3.5 animate-spin text-blue-400" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  <span className="text-xs text-blue-400">{downloadPercent}%</span>
                                </div>
                              )}
                              {downloadProgress?.status === 'pending' && (
                                <span className="text-xs text-neutral-500 uppercase">Queued</span>
                              )}
                              {hasExternalUrl && !downloaded && !isDownloading && !downloadProgress && (
                                <span className="text-xs text-orange-500 uppercase px-1.5 py-0.5 border border-orange-500/30">
                                  {isMangaPlus ? 'M+' : 'EXT'}
                                </span>
                              )}
                              
                              {!isSelectionMode && (
                                downloaded && !isDownloading ? (
                                  <button
                                    onClick={() => handleDeleteChapter(chapter.id)}
                                    className="p-1 text-neutral-600 hover:text-red-500 transition-colors"
                                    title="Delete offline"
                                  >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                ) : isOnline && !hasExternalUrl && !isUnavailable && !downloadProgress && (
                                  <button
                                    onClick={() => fullChapter && downloadChapters(mangaId, manga.title, [fullChapter], provider)}
                                    className="p-1 text-neutral-600 hover:text-white transition-colors"
                                    title="Download"
                                  >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                  </button>
                                )
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
