import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateMediaSources() {
  console.log('Starting MediaSource migration...');

  // Step 1: Get all unique refIds from MediaItem
  // refId is a required field, so no need to filter for not null
  const mediaItems = await prisma.mediaItem.findMany({
    select: {
      refId: true,
      title: true,
      imageUrl: true,
      total: true,
      type: true,
    },
    distinct: ['refId'],
  });

  console.log(`Found ${mediaItems.length} unique media items to migrate`);

  // Step 2: Create MediaSource for each unique refId
  let created = 0;
  let skipped = 0;

  for (const item of mediaItems) {
    // Check if MediaSource already exists
    const existing = await prisma.mediaSource.findUnique({
      where: { refId: item.refId },
    });

    if (existing) {
      skipped++;
      continue;
    }

    // Create MediaSource
    await prisma.mediaSource.create({
      data: {
        refId: item.refId,
        title: item.title || 'Unknown',
        imageUrl: item.imageUrl,
        total: item.total,
        type: item.type,
      },
    });
    created++;
  }

  console.log(`Created ${created} MediaSource records, skipped ${skipped} existing`);

  // Step 3: Also check Suggestions for any refIds not in MediaItem
  const suggestions = await prisma.suggestion.findMany({
    where: {
      sourceId: null,
    },
    select: {
      refId: true,
      title: true,
      imageUrl: true,
      type: true,
    },
    distinct: ['refId'],
  });

  for (const suggestion of suggestions) {
    const existing = await prisma.mediaSource.findUnique({
      where: { refId: suggestion.refId },
    });

    if (existing) continue;

    await prisma.mediaSource.create({
      data: {
        refId: suggestion.refId,
        title: suggestion.title || 'Unknown',
        imageUrl: suggestion.imageUrl,
        total: null,
        type: suggestion.type,
      },
    });
    created++;
  }

  console.log(`Total MediaSource records created: ${created}`);

  // Step 4: Link MediaItems to MediaSources
  const sources = await prisma.mediaSource.findMany({
    select: { id: true, refId: true },
  });
  const sourceMap = new Map(sources.map(s => [s.refId, s.id]));

  let linkedItems = 0;
  const itemsToUpdate = await prisma.mediaItem.findMany({
    where: { sourceId: null },
    select: { id: true, refId: true },
  });

  for (const item of itemsToUpdate) {
    const sourceId = sourceMap.get(item.refId);
    if (sourceId) {
      await prisma.mediaItem.update({
        where: { id: item.id },
        data: { sourceId },
      });
      linkedItems++;
    }
  }

  console.log(`Linked ${linkedItems} MediaItems to MediaSources`);

  // Step 5: Link Suggestions to MediaSources
  let linkedSuggestions = 0;
  const suggestionsToUpdate = await prisma.suggestion.findMany({
    where: { sourceId: null },
    select: { id: true, refId: true },
  });

  for (const suggestion of suggestionsToUpdate) {
    const sourceId = sourceMap.get(suggestion.refId);
    if (sourceId) {
      await prisma.suggestion.update({
        where: { id: suggestion.id },
        data: { sourceId },
      });
      linkedSuggestions++;
    }
  }

  console.log(`Linked ${linkedSuggestions} Suggestions to MediaSources`);

  console.log('Migration complete!');
}

migrateMediaSources()
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
