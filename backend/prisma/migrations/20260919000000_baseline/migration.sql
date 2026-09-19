-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('TV', 'MOVIE', 'ANIME', 'MANGA', 'BOOK', 'LIGHT_NOVEL', 'COMIC', 'GAME');

-- CreateEnum
CREATE TYPE "MediaStatus" AS ENUM ('WATCHING', 'READING', 'PLAYING', 'COMPLETED', 'PLAN_TO_WATCH', 'DROPPED', 'PAUSED');

-- CreateEnum
CREATE TYPE "FriendRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ReactionType" AS ENUM ('LIKE', 'HELPFUL', 'FUNNY', 'INSIGHTFUL', 'SPOILER');

-- CreateEnum
CREATE TYPE "CollectionRole" AS ENUM ('OWNER', 'EDITOR', 'VIEWER');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" VARCHAR(32) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255),
    "display_name" VARCHAR(64),
    "avatar_url" VARCHAR(500),
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "recovery_email" VARCHAR(255),
    "recovery_email_verified" BOOLEAN NOT NULL DEFAULT false,
    "recovery_email_token" VARCHAR(255),
    "recovery_email_token_exp" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_items" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" VARCHAR(255),
    "type" "MediaType" NOT NULL,
    "status" "MediaStatus" NOT NULL,
    "current" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER,
    "notes" TEXT,
    "rating" SMALLINT,
    "image_url" VARCHAR(500),
    "ref_id" VARCHAR(100) NOT NULL,
    "source_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "platforms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metacritic" SMALLINT,
    "genres" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "playtime_hours" SMALLINT,

    CONSTRAINT "media_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_sources" (
    "id" TEXT NOT NULL,
    "ref_id" VARCHAR(100) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "image_url" VARCHAR(500),
    "total" INTEGER,
    "type" "MediaType" NOT NULL,
    "year" SMALLINT,
    "release_date" VARCHAR(50),
    "description" TEXT,
    "genres" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "platforms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "playtime_hours" SMALLINT,

    CONSTRAINT "media_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_source_aliases" (
    "id" TEXT NOT NULL,
    "media_source_id" TEXT NOT NULL,
    "ref_id" VARCHAR(200) NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_source_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "friendships" (
    "id" TEXT NOT NULL,
    "follower_id" TEXT NOT NULL,
    "following_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "friendships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "friend_requests" (
    "id" TEXT NOT NULL,
    "from_user_id" TEXT NOT NULL,
    "to_user_id" TEXT NOT NULL,
    "status" "FriendRequestStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "friend_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" VARCHAR(500) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suggestions" (
    "id" TEXT NOT NULL,
    "from_user_id" TEXT NOT NULL,
    "to_user_id" TEXT NOT NULL,
    "title" VARCHAR(255),
    "type" "MediaType" NOT NULL,
    "ref_id" TEXT NOT NULL,
    "image_url" TEXT,
    "message" TEXT,
    "status" "SuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "source_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" VARCHAR(32) NOT NULL,
    "provider_id" TEXT NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "oauth_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "watch_progress" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "media_id" VARCHAR(100) NOT NULL,
    "episode_id" VARCHAR(100) NOT NULL,
    "episode_number" INTEGER,
    "season_number" INTEGER,
    "current_time" DOUBLE PRECISION NOT NULL,
    "duration" DOUBLE PRECISION NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "watch_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_mappings" (
    "id" TEXT NOT NULL,
    "ref_id" VARCHAR(100) NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "provider_id" VARCHAR(255) NOT NULL,
    "provider_title" VARCHAR(255) NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "verified_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "content" VARCHAR(2000) NOT NULL,
    "ref_id" VARCHAR(100) NOT NULL,
    "media_type" "MediaType" NOT NULL,
    "season_number" INTEGER,
    "episode_number" INTEGER,
    "chapter_number" INTEGER,
    "volume_number" INTEGER,
    "external_source" VARCHAR(50),
    "external_id" VARCHAR(255),
    "external_author" VARCHAR(100),
    "external_author_avatar" VARCHAR(500),
    "external_url" VARCHAR(500),
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "is_spoiler" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comment_reactions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "comment_id" TEXT NOT NULL,
    "reaction_type" "ReactionType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comment_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collections" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "cover_url" VARCHAR(500),
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "owner_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_items" (
    "id" TEXT NOT NULL,
    "collection_id" TEXT NOT NULL,
    "ref_id" VARCHAR(100) NOT NULL,
    "title" VARCHAR(255),
    "image_url" VARCHAR(500),
    "type" "MediaType" NOT NULL,
    "order_index" INTEGER NOT NULL,
    "note" TEXT,
    "source_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collection_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_members" (
    "id" TEXT NOT NULL,
    "collection_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "CollectionRole" NOT NULL DEFAULT 'VIEWER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collection_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_stars" (
    "id" TEXT NOT NULL,
    "collection_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collection_stars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_invites" (
    "id" TEXT NOT NULL,
    "collection_id" TEXT NOT NULL,
    "token" VARCHAR(64) NOT NULL,
    "role" "CollectionRole" NOT NULL DEFAULT 'VIEWER',
    "max_uses" INTEGER,
    "use_count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collection_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_comments" (
    "id" TEXT NOT NULL,
    "collection_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "content" VARCHAR(2000) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collection_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "media_items_user_id_idx" ON "media_items"("user_id");

-- CreateIndex
CREATE INDEX "media_items_user_id_type_idx" ON "media_items"("user_id", "type");

-- CreateIndex
CREATE INDEX "media_items_source_id_idx" ON "media_items"("source_id");

-- CreateIndex
CREATE UNIQUE INDEX "media_items_user_id_ref_id_key" ON "media_items"("user_id", "ref_id");

-- CreateIndex
CREATE UNIQUE INDEX "media_sources_ref_id_key" ON "media_sources"("ref_id");

-- CreateIndex
CREATE UNIQUE INDEX "media_source_aliases_ref_id_key" ON "media_source_aliases"("ref_id");

-- CreateIndex
CREATE INDEX "media_source_aliases_media_source_id_idx" ON "media_source_aliases"("media_source_id");

-- CreateIndex
CREATE INDEX "friendships_follower_id_idx" ON "friendships"("follower_id");

-- CreateIndex
CREATE INDEX "friendships_following_id_idx" ON "friendships"("following_id");

-- CreateIndex
CREATE UNIQUE INDEX "friendships_follower_id_following_id_key" ON "friendships"("follower_id", "following_id");

-- CreateIndex
CREATE UNIQUE INDEX "friend_requests_from_user_id_to_user_id_key" ON "friend_requests"("from_user_id", "to_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_idx" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "suggestions_from_user_id_idx" ON "suggestions"("from_user_id");

-- CreateIndex
CREATE INDEX "suggestions_to_user_id_idx" ON "suggestions"("to_user_id");

-- CreateIndex
CREATE INDEX "suggestions_to_user_id_status_idx" ON "suggestions"("to_user_id", "status");

-- CreateIndex
CREATE INDEX "suggestions_source_id_idx" ON "suggestions"("source_id");

-- CreateIndex
CREATE UNIQUE INDEX "suggestions_from_user_id_to_user_id_ref_id_key" ON "suggestions"("from_user_id", "to_user_id", "ref_id");

-- CreateIndex
CREATE INDEX "oauth_accounts_user_id_idx" ON "oauth_accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_accounts_provider_provider_id_key" ON "oauth_accounts"("provider", "provider_id");

-- CreateIndex
CREATE INDEX "watch_progress_user_id_idx" ON "watch_progress"("user_id");

-- CreateIndex
CREATE INDEX "watch_progress_user_id_media_id_idx" ON "watch_progress"("user_id", "media_id");

-- CreateIndex
CREATE UNIQUE INDEX "watch_progress_user_id_media_id_episode_id_key" ON "watch_progress"("user_id", "media_id", "episode_id");

-- CreateIndex
CREATE INDEX "provider_mappings_ref_id_idx" ON "provider_mappings"("ref_id");

-- CreateIndex
CREATE INDEX "provider_mappings_provider_idx" ON "provider_mappings"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "provider_mappings_ref_id_provider_key" ON "provider_mappings"("ref_id", "provider");

-- CreateIndex
CREATE INDEX "comments_ref_id_media_type_idx" ON "comments"("ref_id", "media_type");

-- CreateIndex
CREATE INDEX "comments_user_id_idx" ON "comments"("user_id");

-- CreateIndex
CREATE INDEX "comments_created_at_idx" ON "comments"("created_at");

-- CreateIndex
CREATE INDEX "comments_external_source_external_id_idx" ON "comments"("external_source", "external_id");

-- CreateIndex
CREATE INDEX "comment_reactions_comment_id_idx" ON "comment_reactions"("comment_id");

-- CreateIndex
CREATE INDEX "comment_reactions_user_id_idx" ON "comment_reactions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "comment_reactions_user_id_comment_id_reaction_type_key" ON "comment_reactions"("user_id", "comment_id", "reaction_type");

-- CreateIndex
CREATE INDEX "collections_owner_id_idx" ON "collections"("owner_id");

-- CreateIndex
CREATE INDEX "collections_is_public_idx" ON "collections"("is_public");

-- CreateIndex
CREATE INDEX "collection_items_collection_id_idx" ON "collection_items"("collection_id");

-- CreateIndex
CREATE INDEX "collection_items_source_id_idx" ON "collection_items"("source_id");

-- CreateIndex
CREATE UNIQUE INDEX "collection_items_collection_id_ref_id_key" ON "collection_items"("collection_id", "ref_id");

-- CreateIndex
CREATE INDEX "collection_members_user_id_idx" ON "collection_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "collection_members_collection_id_user_id_key" ON "collection_members"("collection_id", "user_id");

-- CreateIndex
CREATE INDEX "collection_stars_user_id_idx" ON "collection_stars"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "collection_stars_collection_id_user_id_key" ON "collection_stars"("collection_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "collection_invites_token_key" ON "collection_invites"("token");

-- CreateIndex
CREATE INDEX "collection_invites_collection_id_idx" ON "collection_invites"("collection_id");

-- CreateIndex
CREATE INDEX "collection_invites_token_idx" ON "collection_invites"("token");

-- CreateIndex
CREATE INDEX "collection_comments_collection_id_idx" ON "collection_comments"("collection_id");

-- CreateIndex
CREATE INDEX "collection_comments_user_id_idx" ON "collection_comments"("user_id");

-- AddForeignKey
ALTER TABLE "media_items" ADD CONSTRAINT "media_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_items" ADD CONSTRAINT "media_items_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "media_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_source_aliases" ADD CONSTRAINT "media_source_aliases_media_source_id_fkey" FOREIGN KEY ("media_source_id") REFERENCES "media_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_following_id_fkey" FOREIGN KEY ("following_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friend_requests" ADD CONSTRAINT "friend_requests_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friend_requests" ADD CONSTRAINT "friend_requests_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "media_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watch_progress" ADD CONSTRAINT "watch_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_reactions" ADD CONSTRAINT "comment_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_reactions" ADD CONSTRAINT "comment_reactions_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collections" ADD CONSTRAINT "collections_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "media_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_members" ADD CONSTRAINT "collection_members_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_members" ADD CONSTRAINT "collection_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_stars" ADD CONSTRAINT "collection_stars_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_stars" ADD CONSTRAINT "collection_stars_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_invites" ADD CONSTRAINT "collection_invites_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_comments" ADD CONSTRAINT "collection_comments_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_comments" ADD CONSTRAINT "collection_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
