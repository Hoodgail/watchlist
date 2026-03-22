import type { ExternalCommentsGateway } from '../ports/ExternalCommentsGateway.js';
import type { SupportedCommentMediaType } from '../dto/comments.js';

export function createGetExternalProvidersUseCase(dependencies: { externalCommentsGateway: ExternalCommentsGateway }) {
  return async function getExternalProviders() {
    return dependencies.externalCommentsGateway.getAllProviders();
  };
}

export function createGetExternalProvidersForMediaTypeUseCase(dependencies: { externalCommentsGateway: ExternalCommentsGateway }) {
  return async function getExternalProvidersForMediaType(query: { mediaType: SupportedCommentMediaType }) {
    return dependencies.externalCommentsGateway.getProvidersForMediaType(query.mediaType);
  };
}

export function createFetchExternalCommentsUseCase(dependencies: { externalCommentsGateway: ExternalCommentsGateway }) {
  return async function fetchExternalComments(command: {
    refId: string;
    mediaType: SupportedCommentMediaType;
    title: string;
    options?: Parameters<ExternalCommentsGateway['fetchAndImportComments']>[3];
  }) {
    return dependencies.externalCommentsGateway.fetchAndImportComments(command.refId, command.mediaType, command.title, command.options);
  };
}

export function createFetchExternalCommentsFromProviderUseCase(dependencies: { externalCommentsGateway: ExternalCommentsGateway }) {
  return async function fetchExternalCommentsFromProvider(command: {
    providerName: string;
    refId: string;
    mediaType: SupportedCommentMediaType;
    title: string;
    options?: Parameters<ExternalCommentsGateway['fetchFromProvider']>[4];
  }) {
    return dependencies.externalCommentsGateway.fetchFromProvider(command.providerName, command.refId, command.mediaType, command.title, command.options);
  };
}

export function createFetchExternalCommentsWithResolutionUseCase(dependencies: { externalCommentsGateway: ExternalCommentsGateway }) {
  return async function fetchExternalCommentsWithResolution(command: Parameters<ExternalCommentsGateway['fetchCommentsWithResolution']>[0]) {
    return dependencies.externalCommentsGateway.fetchCommentsWithResolution(command);
  };
}

export function createPreviewExternalResolutionUseCase(dependencies: { externalCommentsGateway: ExternalCommentsGateway }) {
  return async function previewExternalResolution(query: Parameters<ExternalCommentsGateway['previewResolution']>[0]) {
    return dependencies.externalCommentsGateway.previewResolution(query);
  };
}

export function createRefreshExternalCommentsUseCase(dependencies: { externalCommentsGateway: ExternalCommentsGateway }) {
  return async function refreshExternalComments() {
    return dependencies.externalCommentsGateway.refreshExternalCommentsForPopularMedia();
  };
}
