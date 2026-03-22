export interface ProfileVisibilityContext {
  isPublic: boolean;
  isOwnProfile: boolean;
  isFollowing: boolean;
}

export function canViewProfileList(context: ProfileVisibilityContext): boolean {
  return context.isPublic || context.isOwnProfile || context.isFollowing;
}
