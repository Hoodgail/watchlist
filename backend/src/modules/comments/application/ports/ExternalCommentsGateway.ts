import type {
  AggregatedComments,
  CommentFetchWithResolutionParams,
  ExternalCommentProvider,
  ImportResult,
  ResolutionPreviewResult,
  SupportedCommentMediaType,
} from '../dto/comments.js';

export interface ExternalCommentsGateway {
  getAllProviders(): ExternalCommentProvider[];
  getProvidersForMediaType(mediaType: SupportedCommentMediaType): ExternalCommentProvider[];
  getProvider(name: string): ExternalCommentProvider | undefined;
  fetchAndImportComments(
    refId: string,
    mediaType: SupportedCommentMediaType,
    title: string,
    options?: {
      year?: number;
      seasonNumber?: number;
      episodeNumber?: number;
      chapterNumber?: number;
      volumeNumber?: number;
      limit?: number;
      providerNames?: string[];
      providerIds?: {
        hianimeEpisodeId?: string;
        [key: string]: string | undefined;
      };
    },
  ): Promise<ImportResult>;
  fetchFromProvider(
    providerName: string,
    refId: string,
    mediaType: SupportedCommentMediaType,
    title: string,
    options?: {
      year?: number;
      seasonNumber?: number;
      episodeNumber?: number;
      chapterNumber?: number;
      volumeNumber?: number;
      limit?: number;
      providerIds?: {
        hianimeEpisodeId?: string;
        [key: string]: string | undefined;
      };
    },
  ): Promise<ImportResult>;
  fetchCommentsWithResolution(params: CommentFetchWithResolutionParams): Promise<AggregatedComments>;
  previewResolution(params: CommentFetchWithResolutionParams): Promise<ResolutionPreviewResult>;
  refreshExternalCommentsForPopularMedia(): Promise<{ mediaProcessed: number; totalImported: number }>;
}
