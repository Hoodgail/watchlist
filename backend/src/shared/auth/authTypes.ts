export interface AuthTokenPayload {
  userId: string;
  email: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}
