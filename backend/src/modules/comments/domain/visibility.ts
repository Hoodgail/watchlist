export interface CommentVisibilityContext {
  requesterId?: string;
  followingUserIds: string[];
  includeExternal?: boolean;
}

export type CommentVisibilityRule =
  | { kind: 'own'; userId: string }
  | { kind: 'following'; userIds: string[] }
  | { kind: 'public' }
  | { kind: 'external' };

export function getCommentVisibilityRules(context: CommentVisibilityContext): CommentVisibilityRule[] {
  const rules: CommentVisibilityRule[] = [{ kind: 'public' }];

  if (context.requesterId) {
    rules.unshift({ kind: 'own', userId: context.requesterId });
  }

  if (context.followingUserIds.length > 0) {
    rules.push({ kind: 'following', userIds: context.followingUserIds });
  }

  if (context.includeExternal) {
    rules.push({ kind: 'external' });
  }

  return rules;
}
