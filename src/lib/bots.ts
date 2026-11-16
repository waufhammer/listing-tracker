// Link previews and crawlers (Slack, iMessage/Apple, Facebook, Gmail's image
// proxy, search engines) open the link without a person behind them.
const BOT_UA =
  /slackbot|facebookexternalhit|facebot|twitterbot|whatsapp|googlebot|applebot|bingbot|gmail|googleimageproxy|discordbot|linkedinbot|telegrambot|skypeuripreview|bot\b|bot\/|crawler|spider|preview/i;

export function isBotUserAgent(ua: string | null | undefined): boolean {
  return !ua || BOT_UA.test(ua);
}
