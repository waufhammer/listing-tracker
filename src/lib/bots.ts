// Link previews and crawlers (Slack, iMessage/Apple, Facebook, Gmail's image
// proxy, search engines) open the link without a person behind them.
const BOT_UA =
  /slackbot|facebookexternalhit|facebot|twitterbot|whatsapp|googlebot|applebot|bingbot|gmail|googleimageproxy|discordbot|linkedinbot|telegrambot|skypeuripreview|bot\b|bot\/|crawler|spider|preview/i;

// Scripts and command-line tools (curl, wget, Python, Node, Go, test tools,
// headless browsers) aren't sellers either.
const SCRIPT_UA =
  /^(curl|wget|httpie|python-requests|python-urllib|python-httpx|aiohttp|go-http-client|node-fetch|node|undici|axios|okhttp|java|libwww-perl|postmanruntime|insomnia)\b|headlesschrome|phantomjs|puppeteer|playwright/i;

export function isBotUserAgent(ua: string | null | undefined): boolean {
  return !ua || BOT_UA.test(ua) || SCRIPT_UA.test(ua);
}
