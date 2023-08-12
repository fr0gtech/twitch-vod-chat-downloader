
import * as fs from 'fs'
import puppeteer from 'puppeteer'
import * as cliProgress from "cli-progress"

const multibar = new cliProgress.MultiBar({
    clearOnComplete: false,
    hideCursor: true,
    format: ' {bar} | {filename} | {value}/{total}',
}, cliProgress.Presets.shades_grey);


const MAX_RETRIES = 10

/**
 * This gets the twitch clientid and a vodDuration
 * @param vodId: the ID of the vod to download
 * @param retryCount: the amout of times the function has been retried
 * @returns [clientid, vodDuration]
 */
const getTwitchClientId = async (vodId: string, retryCount = 0): Promise<object> => {
    try {
        const browser = await puppeteer.launch({
            headless: true,
            args: ["--no-sandbox"],
            executablePath: '/usr/bin/google-chrome-stable'
        });
        const page = await browser.newPage();
        await page.goto("https://www.twitch.tv/videos/" + vodId);
        await page.setRequestInterception(true);
        await page.waitForSelector('button[data-a-target="user-menu-toggle"]');
        await page.click('button[data-a-target="user-menu-toggle"]');
        const headersPromise = new Promise<object>(async (resolve, reject) => {

            const vodDuration: any = await page.$eval('p[data-a-target="player-seekbar-duration"]', element => element.textContent);

            const timeout = setTimeout(async () => {
                console.log("hit timeout");
                await browser.close();
                if (retryCount < MAX_RETRIES) {
                    const headers = await getTwitchClientId(vodId, retryCount + 1);
                    resolve(headers);
                } else {
                    reject(new Error(`Exceeded maximum retries (${MAX_RETRIES})`));
                }
            }, 5000);

            page.on("request", (request: any) => {
                if (request.headers()['client-id'] !== undefined) {
                    console.log("got client id");
                    clearTimeout(timeout);
                    resolve([request.headers(), vodDuration]);
                }
            });

        });

        const headers = await headersPromise;
        await browser.close();
        return headers;
    } catch (error) {
        console.error("Error in getTwitchClientId:", error);
        throw error;
    }
};

interface ChatUser {
    username: string;
    userId: string;
    messageCount: number;
  }

/**
 * This downloads a full chat
 * @param vodId : the ID of the vod to download
 */

async function getTwitchChat(vodId: string) {
    let all: any[] = [];
    let run = true
    const [headers, vodDuration]: any = await getTwitchClientId(vodId);
    let contentOffset = 0

    const userMap: { [userId: string]: ChatUser } = {};
    let bars:any = []
    for (let index = 0; index < 26; index++) {
        bars[index] = multibar.create(200,0)
    }
    bars[0].setTotal(hmsToSecondsOnly(vodDuration));

    let body: any = {
        "operationName": "VideoCommentsByOffsetOrCursor",
        "variables": {
            "videoID": vodId,
            "contentOffsetSeconds": contentOffset
        },
        "extensions": {
            "persistedQuery": {
                "version": 1,
                "sha256Hash": "b70a3591ff0f4e0313d126c6a1502d79a1c02baebb288227c582044aa76adf6a"
            }
        }
    }
    while (run) {
        let res = await fetch("https://gql.twitch.tv/gql#origin=twilight", {
            "headers": {
                "Client-Id": headers["client-id"],
            },
            "referrer": "https://www.twitch.tv/",
            "body": JSON.stringify(body),
            "method": "POST",
            "mode": "cors"
        }).then((e) => e.json())
        if (res.data.video.comments === null) {
            console.log("no next page");
            run = false
        } else if (res.data.video.comments.pageInfo.hasNextPage) {
            body.variables.contentOffsetSeconds = res.data.video.comments.edges[res.data.video.comments.edges.length - 1].node.contentOffsetSeconds + 1
            // User ranking
            res.data.video.comments.edges.forEach((e: any) => {              
                if(e.node.message.fragments[0] === undefined || e.node.commenter === null) return;
                if (userMap[e.node.commenter.id]) {
                  userMap[e.node.commenter.id].messageCount++;
                } else {
                  userMap[e.node.commenter.id] = {
                    username: e.node.commenter.displayName,
                    userId: e.node.commenter.id,
                    messageCount: 1,
                  };
                }
            })
          
        }
      

        //bar
        const users: ChatUser[] = Object.values(userMap);
        users.sort((a, b) => b.messageCount - a.messageCount);
        const topUsers = users.slice(0, 25);
        topUsers.forEach((user, index) => {
            bars[index + 1].update(topUsers[index].messageCount, {filename: topUsers[index].username});
            bars[index + 1].setTotal(topUsers[0].messageCount + (topUsers[0].messageCount / 100) * 10 )
        });
        bars[0].update(res.data.video.comments.edges[res.data.video.comments.edges.length - 1].node.contentOffsetSeconds + 1, {filename: `vod: ${vodId}`});

        // console.log(`got:${res.data.video.comments.edges.length} msgs, total:${all.length}, timestamp:${secondsToHMS(body.variables.contentOffsetSeconds)}/${vodDuration}`);
    }
    fs.writeFileSync(`${vodId}.json`, JSON.stringify(all))

}

getTwitchChat("1888587236");


const secondsToHMS = (secs:string) => {
    var sec_num = parseInt(secs, 10)
    var hours   = Math.floor(sec_num / 3600)
    var minutes = Math.floor(sec_num / 60) % 60
    var seconds = sec_num % 60

    return [hours,minutes,seconds]
        .map(v => v < 10 ? "0" + v : v)
        .filter((v,i) => v !== "00" || i > 0)
        .join(":")
}

function hmsToSecondsOnly(str:any) {
    var p = str.split(':'),
        s = 0, m = 1;

    while (p.length > 0) {
        s += m * parseInt(p.pop(), 10);
        m *= 60;
    }

    return s;
}