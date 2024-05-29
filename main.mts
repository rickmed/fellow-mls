import { chromium, type BrowserContext, type Browser } from 'playwright'

const timeout = 12_000
let browser!: Browser
let browserCtx!: BrowserContext

async function main() {
   browser = await chromium.launch({headless: false, timeout})
   browserCtx = await browser.newContext()
   const page = await browserCtx.newPage()
   page.setDefaultTimeout(timeout)

   await page.goto(`https://ven.flexmls.com/`)

   await page.locator("#user").fill(`ven.anarodriguez`)
   await page.locator(`#login-button`).click()

   await page.locator(`#password`).fill(`Manuelm87`)
   await page.locator(`#login-button`).click()

   const topFrame = page.frameLocator(`#top_frame`)
   await topFrame.locator(`#bookmarkMenuItems *[data-id="SavedSearches"]`).click()

   const viewFrame = topFrame.frameLocator(`#view_frame`)

   await viewFrame.getByText(`Zonas Anais`).click()

   // when the last tr is scraped, need to scroll
      // elem.scroll(0, 300_000)  300_000 just a bigger number to make sure it scrolls all the way down.
      // 100 new tr should be put in place of the old ones.
      // so need to go back to the first tr and start scraping.

   // table to scroll: `#gridC` inside view_frame
   // first tr selector:
      // `#thegridbody:first-child` first child of this
      // or #thegridbody:nth-child(1)

   // scroll element #gridC
//    await page.evaluate(() => {
//       window.scrollTo(0, document.body.scrollHeight);
//   });

// scrape only inmuebles details y codigos de cada photo thumbnail
   // (no need to click to see bigger one)
   // I can map thumbnail photo id to query big photo directly from cdn


console.log("sleepin'")
   await sleep(5_000)
   await terminateProgram()
}

try {
   await main()
}
catch (e) {
   console.log("Something went wrong.")
   console.log(e)
   await terminateProgram()
}


async function terminateProgram() {
   console.log("Program Done")
   if (browserCtx) await browserCtx.close()
   if (browser) await browser.close()
}

function sleep(ms: number) {
   return new Promise(res => {
      setTimeout(res, ms)
   })
}