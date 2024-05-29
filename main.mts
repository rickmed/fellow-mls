import { chromium, type BrowserContext, type Browser } from 'playwright'

const timeout = 7_000
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
   const viewFrame = topFrame.frameLocator(`#view_frame`)

   await topFrame.locator(`#bookmarkMenuItems *[data-id="SavedSearches"]`).click()
   await viewFrame.getByText(`Zonas Anais`).click()

   await viewFrame.locator(`#thegridbody`).waitFor()
   await viewFrame.locator(`#header_for_grid`).getByText(`MLS #`).click()
   await viewFrame.locator(`#dropmenudiv`).getByText(`Sort Descending`).click()

   await viewFrame.locator(`#thegridbody`).waitFor()
   await viewFrame.getByTitle(`Review Listings in Detail`).click()

   // scrape property details
   // dentro de #iframe_detail  (Details)


   // await viewFrame.locator(`#thegridbody:nth-child(1)`).click()





   // loop until all properties are scraped:
   // click first tr property

   // first tr selector:
   // `` first child of this
   // or #thegridbody:nth-child(1)
   // page.locator('div.some-class').nth(3)

   // await viewFrame.locator(`#thegridbody`).nth(2).click()


   // const result = await page.evaluate(async (str) => {
   //    console.log("holaa")
   //    return `${str}: rick`
   //  }, "hi");
   //  console.log({result}); // prints "56"


// var iframe = document.getElementById('iframeId');
// var innerDoc = iframe.contentDocument || iframe.contentWindow.document;

   // click detail `#tab_detail` inside view frame
   // click photos `#tab_tour` inside view frame

   // scrape photo thumbnails id:
      // inside: #gallery_section (inside #iframe_tour inside #view_frame)
      // all role="img"
         // style
   // document.querySelectorAll(".great-banner.live-banner")[0].style.backgroundImage

   // when the last tr is scraped, need to scroll
      // elem.scroll(0, 300_000)  300_000 just a bigger number to make sure it scrolls all the way down.
      // 100 new tr should be put in place of the old ones.
      // so need to go back to the first tr and start scraping.


   // table to scroll: `#gridC` inside view_frame


   // scroll element #gridC
//    await page.evaluate(() => {
//       window.scrollTo(0, document.body.scrollHeight);
//   });

// scrape only inmuebles details y codigos de cada photo thumbnail
   // (no need to click to see bigger one)
   // I can map thumbnail photo id to query big photo directly from cdn

   const sleepTime = 5_000
   console.log("sleepin'", sleepTime)
   await sleep(sleepTime)
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