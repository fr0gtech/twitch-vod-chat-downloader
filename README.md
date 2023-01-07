# Twitch vod chat downloader

Very simple template to download a twitch chat from a vod.

## Installing

`yarn`

We use puppeteer to get the clientId so make sure you have puppeteer installed and configured correctly.

## Running

In `app.ts` we run a function that downloads the chat it takes the vod id as a string

```js
(async() =>{
    await getChatFromTwitch("1698057203")
})()
```

`ts-node app.ts` - To run the file