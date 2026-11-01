async function check() {
  const url = 'https://open.spotify.com/intl-tr/track/0wwJSut39szv3nU71K64j0';
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'
    }
  });
  console.log('Status with FB bot:', res.status);
  const text = await res.text();
  const ogTitle = text.match(/<meta property="og:title" content="([^"]+)"/i);
  const ogDesc = text.match(/<meta property="og:description" content="([^"]+)"/i);
  const ogImg = text.match(/<meta property="og:image" content="([^"]+)"/i);
  console.log('OG Title:', ogTitle ? ogTitle[1] : 'none');
  console.log('OG Desc:', ogDesc ? ogDesc[1] : 'none');
  console.log('OG Img:', ogImg ? ogImg[1] : 'none');
}

check();
