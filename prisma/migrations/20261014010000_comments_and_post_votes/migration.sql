BEGIN;
ALTER TABLE "Post" ADD COLUMN score INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "commentCount" INTEGER NOT NULL DEFAULT 0 CHECK ("commentCount" >= 0);
CREATE TABLE "Comment" (
  id TEXT PRIMARY KEY, "postId" TEXT NOT NULL, "authorId" TEXT,
  "parentCommentId" TEXT, "parentDepth" INTEGER, depth INTEGER NOT NULL DEFAULT 0,
  content TEXT, version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  "deletedAt" TIMESTAMPTZ(3), "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "Comment_depth" CHECK (
    depth BETWEEN 0 AND 2 AND
    (("parentCommentId" IS NULL AND "parentDepth" IS NULL AND depth=0) OR
     ("parentCommentId" IS NOT NULL AND "parentDepth" IS NOT NULL AND depth="parentDepth"+1))
  ),
  CONSTRAINT "Comment_content" CHECK (
    ("deletedAt" IS NULL AND content IS NOT NULL AND char_length(btrim(content)) BETWEEN 1 AND 3000) OR
    ("deletedAt" IS NOT NULL AND content IS NULL)
  ),
  CONSTRAINT "Comment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"(id) ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Comment_id_postId_depth_key" ON "Comment"(id,"postId",depth);
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_parentCommentId_postId_parentDepth_fkey"
  FOREIGN KEY ("parentCommentId","postId","parentDepth") REFERENCES "Comment"(id,"postId",depth)
  ON DELETE RESTRICT ON UPDATE RESTRICT;
CREATE INDEX "Comment_postId_parentCommentId_createdAt_id_idx" ON "Comment"("postId","parentCommentId","createdAt",id);
CREATE INDEX "Comment_authorId_idx" ON "Comment"("authorId");
CREATE TABLE "PostVote" (
  "postId" TEXT NOT NULL, "userId" TEXT NOT NULL, value INTEGER NOT NULL CHECK (value IN (-1,1)),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "PostVote_pkey" PRIMARY KEY ("postId","userId"),
  CONSTRAINT "PostVote_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PostVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "PostVote_userId_idx" ON "PostVote"("userId");
CREATE INDEX "Post_status_score_createdAt_id_idx" ON "Post"(status,score,"createdAt",id);
CREATE INDEX "Post_status_commentCount_createdAt_id_idx" ON "Post"(status,"commentCount","createdAt",id);
-- Counts come from stored rows, including concurrent writes and cascading account deletion.
CREATE FUNCTION bootverse_vote_score() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='UPDATE' THEN
    IF NEW."postId"<>OLD."postId" OR NEW."userId"<>OLD."userId" THEN
      RAISE EXCEPTION 'Vote identity is immutable' USING ERRCODE='23514';
    END IF;
    UPDATE "Post" SET score=score+NEW.value-OLD.value WHERE id=NEW."postId";
  ELSIF TG_OP='INSERT' THEN
    UPDATE "Post" SET score=score+NEW.value WHERE id=NEW."postId";
  ELSE
    UPDATE "Post" SET score=score-OLD.value WHERE id=OLD."postId";
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER "PostVote_score" AFTER INSERT OR UPDATE OR DELETE ON "PostVote"
  FOR EACH ROW EXECUTE FUNCTION bootverse_vote_score();
CREATE FUNCTION bootverse_comment_count() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='UPDATE' THEN
    IF NEW.id<>OLD.id OR NEW."postId"<>OLD."postId" OR
       NEW."parentCommentId" IS DISTINCT FROM OLD."parentCommentId" OR
       NEW."parentDepth" IS DISTINCT FROM OLD."parentDepth" OR NEW.depth<>OLD.depth THEN
      RAISE EXCEPTION 'Comment thread identity is immutable' USING ERRCODE='23514';
    END IF;
    UPDATE "Post" SET "commentCount"="commentCount"+
      (CASE WHEN NEW."deletedAt" IS NULL THEN 1 ELSE 0 END)-
      (CASE WHEN OLD."deletedAt" IS NULL THEN 1 ELSE 0 END) WHERE id=NEW."postId";
  ELSIF TG_OP='INSERT' AND NEW."deletedAt" IS NULL THEN
    UPDATE "Post" SET "commentCount"="commentCount"+1 WHERE id=NEW."postId";
  ELSIF TG_OP='DELETE' AND OLD."deletedAt" IS NULL THEN
    UPDATE "Post" SET "commentCount"="commentCount"-1 WHERE id=OLD."postId";
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER "Comment_count" AFTER INSERT OR UPDATE OR DELETE ON "Comment"
  FOR EACH ROW EXECUTE FUNCTION bootverse_comment_count();
COMMIT;
