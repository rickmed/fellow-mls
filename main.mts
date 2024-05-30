import { chromium, type BrowserContext, type Browser, FrameLocator } from "playwright"

const timeout = 10_000
let browser!: Browser
let browserCtx!: BrowserContext

type FlexCode = string
type Map_ = Map<string, string>
type DataContent = {
   ubicacion: Map_,
   direccion: Map_
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

   /* Open listings of Zonas Anais saved search */
   await topFrame.locator(`#bookmarkMenuItems *[data-id="SavedSearches"]`).click()
   await viewFrame.getByText(`Zonas Anais`).click()

   /* Sort estates MLS# descending (from newest inserted to oldest) */
   /*    await viewFrame.locator(`#thegridbody`).waitFor()
      await viewFrame.locator(`#header_for_grid`).getByText(`MLS #`).click()
      await viewFrame.locator(`#dropmenudiv`).getByText(`Sort Descending`).click() */

   /* Srape Detail Data */
   await viewFrame.locator(`#thegridbody`).waitFor()
   await viewFrame.locator(`#tab_detail`).click()
   const iframeDetail = viewFrame.frameLocator(`#iframe_detail`)   // idem Photos

   let estateData: EstateData = new Map()

   // const ubicacionData = await scrapeUbicacionSection(iframeDetail)
   // const direccionData = await scrapeDireccionSection(iframeDetail)
   // const descripcionData = await scrapeDescripcionSection(iframeDetail)
   // const infoGenData = await scrapeInfoGenSection(iframeDetail)
   // const detallesData = await scrapeDetallesSection(iframeDetail)
   // const infoInternaData = await scrapeInfoInternaGenSection(iframeDetail)

   /* Srape Photos Data */
   await viewFrame.locator(`#tab_tour`).click()
   const photosData = await scrapePhotosData(viewFrame)
   console.log({photosData})



   // loop until all estates are scraped
   // how?
   // click first tr estate

   // first tr selector:
   // `` first child of this
   // or #thegridbody:nth-child(1)
   // page.locator('div.some-class').nth(3)

   // await viewFrame.locator(`#thegridbody`).nth(2).click()


   // when the last tr is scraped, need to scroll
   // elem.scroll(0, 300_000)  300_000 just a bigger number to make sure it scrolls all the way down.
   // 100 new tr should be put in place of the old ones.
   // so need to go back to the first tr and start scraping.


   // table to scroll: `#gridC` inside view_frame

   // scroll element #gridC
   //    await page.evaluate(() => {
   //       window.scrollTo(0, document.body.scrollHeight);
   //   });


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

async function scrapeUbicacionSection(iframeDetail: FrameLocator) {

   const ubicacionTable = iframeDetail.locator(".style20080305202843445493000000").first()

   const ubicacionScraped = await ubicacionTable.evaluate((elem) => {

      const trS = elem.querySelectorAll("tbody")[1]?.children
      let data: Array<[string, string]> = []
      if (!trS) return data

      for (const tr_ of trS) {
         const tr = tr_ as HTMLElement
         const keyElem = tr.children[0] as HTMLElement
         const valElem = tr.children[1] as HTMLElement
         const key = keyElem.innerText?.replaceAll(" ", "").replace(":", "")
         const val = valElem.innerText.trim()
         if (!key) continue
         if (!val) continue
         data.push([key, val])
      }

      return data
   })

   let flexCode = ""
   let ubicacionData: Map_ = new Map()

   for (const [key, val] of ubicacionScraped) {
      if (key === "Codigo de Inmueble") {
         flexCode = val
         continue
      }
      ubicacionData.set(key, val)
   }

   return {flexCode, ubicacionData}
}

async function scrapeDireccionSection(iframeDetail: FrameLocator) {

   const direccionScraped = await iframeDetail.getByText("Nombre de Inmueble").evaluate(el => {

      const trS = el.parentElement?.children

      let data: Array<[string, string]> = []
      if (!trS) return data

      let k: string | undefined = undefined

      for (const tr_ of trS) {
         const tr = tr_ as HTMLElement
         if (!k) {
            k = tr.innerText?.trim().replaceAll(" ", "")
            continue
         }
         const val = tr.innerText?.trim()
         if (!val) continue
         data.push([k, val])
         k = undefined
      }
      return data
   })

   return direccionScraped
}

async function scrapeDescripcionSection(iframeDetail: FrameLocator) {

   const descripcionData: Array<[string, string]> = []

   const sectionNames = ["Descripcion: ", "Observaciones: ", "Como Llegar: "]
   for (const secName of sectionNames) {
      try {
         await iframeDetail.getByText(secName).first().waitFor()
      }
      catch (e) {
         if (e instanceof Error && e.name === "TimeoutError") {
            // eslint-disable-next-line no-console
            console.log(`${secName} not available. Moving on`)
            continue
         }
      }
      let [key, val] = await iframeDetail.getByText(secName).first().evaluate((el: HTMLElement) => {

         const key = el.innerText
         const nextSibling = el.nextSibling as HTMLElement
         const val = nextSibling.innerText

         return [key, val]
      })

      key = key.replace(":",  "").replaceAll(" ", "")
      descripcionData.push([key, val])
   }

   return descripcionData
}

async function scrapeInfoGenSection(iframeDetail: FrameLocator) {

   const infoGenScraped = await iframeDetail.getByText("Informacion General").evaluate(el => {

      const tbody = el.nextSibling?.childNodes[0]
      // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
      const trS = tbody?.childNodes!

      const data: Array<[string, string]> = []

      for (const tr of trS) {
         const tdS = tr.childNodes

         let k: string | undefined = undefined

         for (const td_ of tdS) {
            const td = td_ as HTMLElement
            if (!k) {
               k = td.innerText?.trim().replaceAll(" ", "")
               continue
            }
            const val = td.innerText?.trim()
            if (!val) continue
            data.push([k, val])
            k = undefined
         }
      }

      return data
   })

   return infoGenScraped
}

async function scrapeDetallesSection(iframeDetail: FrameLocator) {

   const detallesScraped = await iframeDetail.getByText("Detalles Inmueble:").evaluate(el => {

      const tbody = el.parentElement?.parentElement
      // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
      const trS = tbody?.childNodes!

      const data: Array<[string, string]> = []

      for (const tr of trS) {
         const tdS = tr.childNodes

         let k: string | undefined = undefined

         for (const td_ of tdS) {
            const td = td_ as HTMLElement
            if (!k) {
               k = td.innerText?.trim().replaceAll(" ", "").replace(":", " ")
               continue
            }

            const spanValues = td.innerText
            if (!spanValues) continue
            if (!k) continue
            data.push([k, spanValues])
            k = undefined
         }
      }

      return data
   })

   return detallesScraped.map(([k, vals]) => {
      const structuredVals = vals
         .split(";")
         .map(v => v.split(": "))
      return [k, structuredVals]
   })
}

async function scrapeInfoInternaGenSection(iframeDetail: FrameLocator) {

   const infoGenScraped = await iframeDetail.getByText("Informacion Interna").evaluate(el => {

      const tbody = el.nextSibling?.childNodes[0]
      // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
      const trS = tbody?.childNodes!

      const data: Array<[string, string]> = []

      for (const tr of trS) {
         const tdS = tr.childNodes

         let k: string | undefined = undefined

         for (const td_ of tdS) {
            const td = td_ as HTMLElement
            if (!k) {
               k = td.innerText?.trim().replaceAll(" ", "")
               continue
            }
            const val = td.innerText?.trim()
            if (!val) continue
            data.push([k, val])
            k = undefined
         }
      }

      return data
   })

   return infoGenScraped
}

async function scrapePhotosData(viewFrame: FrameLocator) {

   const photosIDs = await viewFrame.frameLocator(`#iframe_tour`)
      .locator(".rsThumbsContainer")
      .evaluate(el => {
         let photosIDs: string[] = []
         const photoThumbsDivs = el.querySelectorAll(".rsTmb.photo ")
         for (const div of photoThumbsDivs) {
            const style = div.getAttribute("style")
            if (!style) {
               console.log("photo thumbnail has not style attribute")
               continue
            }
            const photoID = style.match(new RegExp(`/ven/(.*?).jpg`))
            if (!photoID) {
               console.log("photoID not found in style")
               continue
            }
            photosIDs.push(photoID[1]!)
         }
         return photosIDs
      })


   return photosIDs
}