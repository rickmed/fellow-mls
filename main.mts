import { chromium, type BrowserContext, type Browser, FrameLocator } from "playwright"

const timeout = 10_000
let browser!: Browser
let browserCtx!: BrowserContext

type FlexCode = string
type Map_ = Map<string, string>
type DataContent = {
   main: Map_,
   direccion:
}
type EstateData = Map<FlexCode, DataContent>

async function main() {
   browser = await chromium.launch({ headless: false, timeout })
   browserCtx = await browser.newContext()
   const page = await browserCtx.newPage()
   page.setDefaultTimeout(timeout)

   // eslint-disable-next-line no-console
   page.on("console", msg => console.log(msg.text()))

   await page.goto(`https://ven.flexmls.com/`)

   await page.locator("#user").fill(`ven.anarodriguez`)
   await page.locator(`#login-button`).click()

   await page.locator(`#password`).fill(`Manuelm87`)
   await page.locator(`#login-button`).click()

   const topFrame = page.frameLocator(`#top_frame`)
   const viewFrame = topFrame.frameLocator(`#view_frame`)

   // open listings of Zonas Anais saved search
   await topFrame.locator(`#bookmarkMenuItems *[data-id="SavedSearches"]`).click()
   await viewFrame.getByText(`Zonas Anais`).click()

   // sort estates MLS # descending (from newest inserted to oldest)
   /*    await viewFrame.locator(`#thegridbody`).waitFor()
      await viewFrame.locator(`#header_for_grid`).getByText(`MLS #`).click()
      await viewFrame.locator(`#dropmenudiv`).getByText(`Sort Descending`).click() */

   // click detail
   await viewFrame.locator(`#thegridbody`).waitFor()
   await viewFrame.locator(`#tab_detail`).click()
   const iframeDetail = viewFrame.frameLocator(`#iframe_detail`)   // idem Photos

   let estateData: EstateData = new Map()

   await scrapeUbicacionSection(iframeDetail, estateData)





   console.dir(direccionData, { depth: 50, compact: false, showHidden: true })

   // console.dir(estateAttrs, {depth: 50, compact: false, showHidden: true})()

   // for (const row of await page.getByRole('listitem').all())
   //    console.log(await row.textContent());


   // click first estate (current table) tr
   // await viewFrame.locator(`#thegridbody:nth-child(1)`).click()


   // loop until all estates are scraped
   // how?
   // click first tr estate

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

   const sleepTime = 3_000
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
   if (browserCtx) { await browserCtx.close() }
   if (browser) { await browser.close() }
}

function sleep(ms: number) {
   return new Promise(res => {
      setTimeout(res, ms)
   })
}

async function scrapeUbicacionSection(iframeDetail: FrameLocator, estateData: EstateData) {

   const ubicacionTable = iframeDetail.locator(".style20080305202843445493000000").first()

   const ubicacionScraped = await ubicacionTable.evaluate((elem) => {

      const trS = elem.querySelectorAll("tbody")[1]?.children
      let data: Array<[string, string]> = []
      if (!trS) return data

      for (const tr of trS) {
         const key = tr.children[0]?.textContent?.trim().replace(":", "")
         const val = tr.children[1]?.textContent?.trim()
         if (!key) continue
         if (!val) continue
         data.push([key, val])
      }

      return data
   })

   let flexCode = ""
   let mainData: Map_ = new Map()

   for (const [key, val] of ubicacionScraped) {
      if (key === "Codigo de Inmueble") {
         flexCode = val
         continue
      }
      mainData.set(key, val)
   }

   estateData.set(flexCode, {main: mainData})
}

async function scrapeDireccionSection(iframeDetail: FrameLocator, estateData: EstateData) {

   const direccionScraped = await iframeDetail.getByText("Nombre de Inmueble").evaluate(el => {

      const trS = el.parentElement?.children

      let data: Array<[string, string]> = []
      if (!trS) return data

      let k: string | undefined = undefined

      for (const tr of trS) {
         if (!k) {
            k = tr.textContent?.trim()
            continue
         }
         const val = tr.textContent?.trim()
         if (!val) continue
         data.push([k, val])
         k = undefined
      }
      return data
   })

   const direccionData = new Map()

   for (const [key, val] of direccionScraped) {
      direccionData.set(key, val)
   }
} 