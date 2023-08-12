import puppeteer from 'puppeteer';

/**
 * This gets the vod duration form the website
 * @param vodId 
 * @returns 
 */
const getTwitchVodDuration = async (vodId: string) => {
    try {
        const browser = await puppeteer.launch({
            headless: false,
            args: ["--no-sandbox"],
            executablePath: '/usr/bin/google-chrome-stable'
        });

        const page = await browser.newPage();
        await page.goto("https://www.twitch.tv/videos/" + vodId);

        // Wait for the VOD duration element to be available and get its content
        const vodDuration:any = await page.$eval('p[data-a-target="player-seekbar-duration"]', element => element.textContent);

        await browser.close();

        return vodDuration.trim(); // Return the VOD duration after trimming any whitespace
    } catch (error) {
        console.error("Error in getTwitchVodDuration:", error);
        return ''; // Return an empty string in case of error
    }
};

// Usage
(async () => {
    try {
        const vodId = "1888587236"; // Replace with the actual VOD ID
        const duration = await getTwitchVodDuration(vodId);
        console.log("VOD Duration:", duration);
    } catch (error) {
        console.error("Error:", error);
    }
})();