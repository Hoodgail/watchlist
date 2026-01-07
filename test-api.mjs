const CHAPTER_ID = "1027248";

async function fetchMangaPlus() {
  const url = `https://jumpg-webapi.tokyo-cdn.com/api/manga_viewer?chapter_id=${CHAPTER_ID}&split=yes&img_quality=high&clang=eng`;
  
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  
  // Find image URLs with their encryption keys (the long hex string after each URL)
  const pattern = /(https:\/\/jumpg-assets\.tokyo-cdn\.com\/secure\/title\/\d+\/chapter\/\d+\/manga_page\/\w+\/(\d+)\.jpg\?[^\s\x00-\x1f]+)[^\w]*([0-9a-f]{128})/g;
  
  let match;
  let count = 0;
  while ((match = pattern.exec(text)) !== null && count < 3) {
    console.log(`Page ${match[2]}:`);
    console.log(`  URL: ${match[1].substring(0, 100)}...`);
    console.log(`  Key: ${match[3]}`);
    console.log();
    count++;
  }
}

fetchMangaPlus().catch(console.error);
