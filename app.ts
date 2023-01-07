import * as fs from 'fs'
import puppeteer from 'puppeteer'

export const getTwitchClientId = async (vodId:string) => {
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox"],
    });
    const page = await browser.newPage();
    await page.goto("https://www.twitch.tv/videos/" + vodId); 
    await page.setRequestInterception(true);
    const result = await new Promise((resolve) =>{
        page.on("request", (request: any) => {
            if (request.headers()['client-id'] !== undefined){
                resolve(request.headers()['client-id'])
            }
          })  
        }
    );
    console.log(`got twitch client_id ${result}`);
    await browser.close();
    return result as string;
};


const getChatFromTwitch = async (vodId: string) => {
    let all:any = [] // TODO make array with duration
    let run = true
    let cursor;
    let data:any = {
        operationName: "VideoCommentsByOffsetOrCursor",
        variables: {
            videoID: vodId,
            contentOffsetSeconds: 0,
        },
        extensions: {
            persistedQuery: {
                version: 1,
                sha256Hash:
                    "b70a3591ff0f4e0313d126c6a1502d79a1c02baebb288227c582044aa76adf6a",
            },
        },
    }
    let url = "https://gql.twitch.tv/gql"
    let config = {
        method: "post",
        headers: {
            "Client-Id": await getTwitchClientId(vodId),
            "Content-Type": "text/plain",
        },
        body: JSON.stringify(data),
    };
    while (run) {
        let res = await fetch(url, config)
        .then((e) => e.json())
        .catch(function (err) {
            console.log("Unable to fetch -", err);
        });
        res.data.video.comments.edges.forEach((e:any)=>all.push(e))

        if (res.data.video.comments.pageInfo.hasNextPage) {
            delete data.variables.contentOffsetSeconds
            cursor = res.data.video.comments.edges[res.data.video.comments.edges.length - 1].cursor
            data.variables.cursor = cursor
            config.body = JSON.stringify(data)
        }else{
            run = false
        }
        console.log(all.length);
    }
    
    fs.writeFileSync(`${vodId}.json`, JSON.stringify(all))
}

(async() =>{
    await getChatFromTwitch("1698057203")
})()
