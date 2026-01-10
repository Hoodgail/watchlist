const axios = require('axios');
const cheerio = require('cheerio');
const { URL } = require('url');

async function fetchHiAnimeComments(targetUrl) {
     try {
          console.log(`[1] Processing URL: ${targetUrl}`);

          // 1. Extract the Episode ID from the URL parameters
          const parsedUrl = new URL(targetUrl);
          const episodeId = parsedUrl.searchParams.get('ep');

          if (!episodeId) {
               throw new Error("Could not find 'ep' parameter in the URL. Please ensure the URL ends with ?ep=XXXX");
          }

          console.log(`[2] Detected Episode ID: ${episodeId}`);

          // 2. Construct the AJAX API Endpoint
          // We use the ID extracted to hit the specific comment list endpoint.
          const apiUrl = `https://hianime.to/ajax/comment/list/${episodeId}?sort=newest`;

          console.log(`[3] Fetching data from API: ${apiUrl}`);

          // 3. Make the Request
          // IMPORTANT: We must mimic a browser request. 'X-Requested-With' is often required for these AJAX endpoints.
          const response = await axios.get(apiUrl, {
               headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': targetUrl,
                    'X-Requested-With': 'XMLHttpRequest',
                    'Accept': 'application/json, text/javascript, */*; q=0.01'
               }
          });

          // for some reason response.data.status is `true` not a number but a boolean.
          // if (response.data.status !== 200) {
          //      throw new Error(`API returned status: ${response.data.status}`);
          // }

          // 4. Parse the HTML Response
          // The API returns HTML wrapped in a JSON object under the key 'html'.
          const htmlContent = response.data.html;
          const $ = cheerio.load(htmlContent);

          const comments = [];

          // Loop through comment items (Reverse engineered class name: .cw_l-line)
          $('.cw_l-line').each((i, element) => {
               const $el = $(element);

               const commentId = $el.attr('id').replace('cm-', '');
               const username = $el.find('.user-name').text().trim();
               const content = $el.find('.content').text().trim();
               const timestamp = $el.find('.time').text().trim();
               const avatar = $el.find('.item-avatar img').attr('src');
               const likes = $el.find('.btn-vote .value').text().trim();

               comments.push({
                    id: commentId,
                    user: username,
                    time: timestamp,
                    content: content,
                    likes: likes || "0",
                    avatar: avatar
               });
          });

          console.log(`[4] Successfully parsed ${comments.length} comments.`);
          return comments;

     } catch (error) {
          console.error("Error fetching comments:", error.message);
          if (error.response && error.response.status === 403) {
               console.error("Note: A 403 error usually means the site is protected by Cloudflare. You may need to use Puppeteer/Playwright to bypass the challenge.");
          }
     }
}

// Execute
const url = 'https://hianime.to/watch/one-piece-100?ep=2530';

fetchHiAnimeComments(url).then(data => {
     if (data) {
          console.log(JSON.stringify(data, null, 2));
     }
});