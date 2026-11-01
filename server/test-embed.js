const axios = require('axios');

async function test() {
  try {
    const res = await axios.get('https://open.spotify.com/embed/track/0wwJSut39szv3nU71K64j0', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const match = res.data.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
    if (match) {
      const data = JSON.parse(match[1]);
      console.log('PAGEPROPS KEYS:', Object.keys(data.props?.pageProps || {}));
      console.log('SAMPLE DATA:', JSON.stringify(data.props?.pageProps).slice(0, 600));
    } else {
      console.log('NO MATCH');
    }
  } catch (err) {
    console.error('ERROR:', err.message);
  }
}

test();
