import React from 'react';
import CollectionForm from '@/features/collections/components/CollectionForm';
import { ConflictResolutionModal } from '@/features/playback/components/ConflictResolutionModal';
import { ChapterReader } from '@/features/manga/components/ChapterReader';
import { MangaDetail } from '@/features/manga/components/MangaDetail';
import MediaDetail from '@/features/playback/components/MediaDetail';
import VideoPlayer from '@/features/playback/components/VideoPlayer';
import { OfflineVideoProvider } from '@/context/OfflineVideoContext';
import type { ChapterInfo } from '@/services/mangadexTypes';
import type { NewItemData } from '@/features/playback/components/ConflictResolutionModal';
import type { Collection, MediaItem, VideoEpisode, VideoProviderName } from '@/types';

interface ReaderState {
  mangaId: string;
  chapterId: string;
  chapters: ChapterInfo[];
  provider: string;
}

interface SelectedMangaState {
  id: string;
  provider: string;
}

interface SelectedMediaState {
  id: string;
  provider: VideoProviderName;
  title?: string;
  mediaType?: 'movie' | 'tv' | 'anime';
}

interface PlayerState {
  mediaId: string;
  episodeId: string;
  episodes: VideoEpisode[];
  provider: VideoProviderName;
  mediaTitle: string;
  episodeNumber?: number;
  seasonNumber?: number;
  mediaType?: 'anime' | 'movie' | 'tv';
}

interface ConflictData {
  newItem: Omit<MediaItem, 'id'>;
  newItemData: NewItemData;
  existingItem: MediaItem;
  similarityScore: number;
  seasonMismatch: boolean;
}

export interface AppOverlaysProps {
  readerState: ReaderState | null;
  onCloseReader: () => void;
  onChapterChange: (chapterId: string) => void;
  playerState: PlayerState | null;
  onClosePlayer: () => void;
  onEpisodeChange: (episodeId: string, episodeNumber?: number, seasonNumber?: number) => void;
  onProviderChange: (provider: VideoProviderName) => void;
  selectedManga: SelectedMangaState | null;
  onCloseManga: () => void;
  onReadChapter: (mangaId: string, chapterId: string) => void;
  selectedMedia: SelectedMediaState | null;
  onCloseMedia: () => void;
  onWatchEpisode: (mediaId: string, episodeId: string, episodes: VideoEpisode[], provider: VideoProviderName, mediaTitle: string, episodeNumber?: number, seasonNumber?: number, mediaType?: 'anime' | 'movie' | 'tv') => void;
  conflictData: ConflictData | null;
  conflictModalOpen: boolean;
  onCloseConflictModal: () => void;
  onConflictMerge: (existingItemId: string, newRefId: string) => Promise<void>;
  onConflictReplace: (existingItemId: string, newItemData: NewItemData) => Promise<void>;
  onConflictKeepBoth: (newItemData: NewItemData) => Promise<void>;
  showCollectionForm: boolean;
  editingCollection: Collection | null;
  onCloseCollectionForm: () => void;
  onSaveCollectionForm: (collection: Collection) => void;
}

export const AppOverlays: React.FC<AppOverlaysProps> = ({
  readerState,
  onCloseReader,
  onChapterChange,
  playerState,
  onClosePlayer,
  onEpisodeChange,
  onProviderChange,
  selectedManga,
  onCloseManga,
  onReadChapter,
  selectedMedia,
  onCloseMedia,
  onWatchEpisode,
  conflictData,
  conflictModalOpen,
  onCloseConflictModal,
  onConflictMerge,
  onConflictReplace,
  onConflictKeepBoth,
  showCollectionForm,
  editingCollection,
  onCloseCollectionForm,
  onSaveCollectionForm,
}) => {
  if (readerState) {
    return (
      <ChapterReader
        mangaId={readerState.mangaId}
        chapterId={readerState.chapterId}
        chapters={readerState.chapters}
        onClose={onCloseReader}
        onChapterChange={onChapterChange}
        provider={readerState.provider as never}
      />
    );
  }

  if (playerState) {
    return (
      <OfflineVideoProvider>
        <VideoPlayer
          mediaId={playerState.mediaId}
          episodeId={playerState.episodeId}
          episodes={playerState.episodes}
          onClose={onClosePlayer}
          onEpisodeChange={onEpisodeChange}
          provider={playerState.provider}
          mediaTitle={playerState.mediaTitle}
          episodeNumber={playerState.episodeNumber}
          seasonNumber={playerState.seasonNumber}
          onProviderChange={onProviderChange}
          mediaType={playerState.mediaType}
        />
      </OfflineVideoProvider>
    );
  }

  if (selectedManga) {
    return (
      <MangaDetail
        mangaId={selectedManga.id}
        onClose={onCloseManga}
        onReadChapter={onReadChapter}
        provider={selectedManga.provider as never}
      />
    );
  }

  if (selectedMedia) {
    return (
      <OfflineVideoProvider>
        <MediaDetail
          mediaId={selectedMedia.id}
          provider={selectedMedia.provider}
          title={selectedMedia.title}
          mediaType={selectedMedia.mediaType}
          onClose={onCloseMedia}
          onWatchEpisode={onWatchEpisode}
        />
      </OfflineVideoProvider>
    );
  }

  return (
    <>
      {conflictData && (
        <ConflictResolutionModal
          isOpen={conflictModalOpen}
          onClose={onCloseConflictModal}
          newItem={conflictData.newItemData}
          existingItem={conflictData.existingItem}
          similarityScore={conflictData.similarityScore}
          seasonMismatch={conflictData.seasonMismatch}
          onMerge={onConflictMerge}
          onReplace={onConflictReplace}
          onKeepBoth={onConflictKeepBoth}
        />
      )}
      {showCollectionForm && (
        <CollectionForm
          collection={editingCollection || undefined}
          onClose={onCloseCollectionForm}
          onSave={onSaveCollectionForm}
        />
      )}
    </>
  );
};

export default AppOverlays;
