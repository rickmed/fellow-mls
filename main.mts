import { chromium, type BrowserContext, type Browser, FrameLocator, Locator } from "playwright"
import { Firestore } from "@google-cloud/firestore"
import { sleep } from "./utils.mjs"


const timeout = 20_000
let browser!: Browser
let browserCtx!: BrowserContext
let db!: Firestore
let timeoutRetries = 3
let nListingsScrapedInSession = 0
const saveToDBBatchSize = 5

try {
   await main()
}
catch (e) {
   console.log("An Unexpected error was thrown.", e)
   await cleanResources()
   console.log("Program Ending.")
   process.exit(1)
}


async function main() {
   while (timeoutRetries > 0) {
      try {
         await start()
         console.log("All scraping done. Program Ending.")
         await cleanResources()
         process.exit(0)
      }
      catch (e) {
         if (e instanceof Error && e.name === "TimeoutError" && timeoutRetries > 0) {
            console.log("Got a TimeoutError.", e)
            --timeoutRetries
            console.log("Retrying. Retries left:", timeoutRetries)
            await cleanResources()
            continue
         }
         throw e
      }
   }
}


/* Main */

async function start() {

   const dbRsrcS = await getDBResources()
   db = dbRsrcS.db

   browser = await chromium.launch({ timeout })
   browserCtx = await browser.newContext()
   const page = await browserCtx.newPage()
   page.setDefaultTimeout(timeout)

   page.on("console", msg => {
      const msg_ = msg.text()
      if (msg_.includes("FMLS")) {
         console.log(msg_)
      }
   })

   await page.goto(`https://ven.flexmls.com/`)

   /* Login */
   await page.locator("#user").fill(`ven.anarodriguez`)
   await page.locator(`#login-button`).click()
   await page.locator(`#password`).fill(`Manuelm87`)
   await page.locator(`#login-button`).click()

   /* Locators used in program */
   const topIFrame = page.frameLocator(`#top_frame`)
   const viewIFrame = topIFrame.frameLocator(`#view_frame`)
   const detailButton = viewIFrame.locator(`#tab_detail`)
   const detailIFrame = viewIFrame.frameLocator(`#iframe_detail`)
   const photosButton = viewIFrame.locator(`#tab_tour`)
   const photosIFrame = viewIFrame.frameLocator(`#iframe_tour`)

   /* Open listings of Zonas Anais saved search */
   await topIFrame.locator(`#bookmarkMenuItems *[data-id="SavedSearches"]`).click()
   await viewIFrame.getByText("Zona Anais").click()

   /* Wait list to load */
   await viewIFrame.locator(`#thegridbody`).waitFor()

   /* Sort listings MLS# descending (from newest inserted to oldest) */
   await viewIFrame.locator(`#header_for_grid`).getByText(`MLS #`).click()
   await viewIFrame.locator(`#dropmenudiv`).getByText(`Sort Descending`).click()
   await viewIFrame.locator(`#firsttimeindiv_innerds img[src="/images/srch_rs/loading.gif"]`).isVisible()
   await viewIFrame.locator(`#firsttimeindiv_innerds img[src="/images/srch_rs/loading.gif"]`).isHidden()
   // couldnt figure what thing to wait for so that findRowIDToScrapeFrom finds correct row_id
   await sleep(2_000)

   const { dbRowID } = dbRsrcS
   let row_id = await findRowIDToScrapeFrom(viewIFrame, dbRowID)
   let batchListingScraped: ListingScraped[] = []

   // eslint-disable-next-line no-constant-condition
   while (true) {

      try {
         // eslint-disable-next-line no-var
         var listingScraped: ListingScraped = await scrapeListing(row_id, viewIFrame, detailButton, detailIFrame, photosButton, photosIFrame)
      }
      catch (e) {
         if (e instanceof Error && e.name === "Error" && e.message === "locator.evaluate: Execution context was destroyed, most likely because of a navigation") {
            console.log("An evaluator failed. Retrying row_id.", { row_id })
            continue
         }
         throw e
      }

      batchListingScraped.push(listingScraped)
      if (batchListingScraped.length === saveToDBBatchSize) {
         await updateDB(batchListingScraped, row_id, db)
         batchListingScraped = []
         nListingsScrapedInSession += saveToDBBatchSize
         console.log({nListingsScrapedInSession})
      }

      const isTrLast = await isTrLastofList(row_id, viewIFrame)
      if (isTrLast) {
         const allListingsScraped = await scrollListDownAndWaitNewLoadedListings(viewIFrame)
         if (allListingsScraped) {
            break
         }
      }

      const newRowID = await getNextSiblingTrRowID(row_id, viewIFrame)
      if (!newRowID) {
         throw Error("FellowMLS. newRowId not found.")
      }

      row_id = newRowID
   }
}


/* Scrape Listings */

async function scrapeListing(row_id: string, viewIFrame: FrameLocator, detailButton: Locator, detailIframe: FrameLocator, photosButton: Locator, photosIframe: FrameLocator) {

   // click correct item of list
   await viewIFrame.locator(`#${row_id}`).click()
   await detailButton.click()
   await waitPrevDetailsContentToChange(row_id, viewIFrame, detailIframe)
   await sleep(500)

   /* Srape Detail Data */
   const { flex_code, ubicacion } = await scrapeUbicacionSection(detailIframe)
   const direccion = await scrapeDireccionSection(detailIframe)
   const descripcion = await scrapeDescripcionSection(detailIframe)
   const info_general = await scrapeInfoGenSection(detailIframe)
   const detalles = await scrapeDetallesSection(detailIframe)
   const info_interna = await scrapeInfoInternaSection(detailIframe)

   /* Srape Photos Data */
   await photosButton.click()
   const photos = await scrapePhotosData(viewIFrame, row_id, photosIframe)

   // so when next list tr is clicked, details page reloads all info inmediately.
   await detailButton.click()

   return {
      flex_code,
      ubicacion,
      direccion,
      descripcion,
      info_general,
      detalles,
      info_interna,
      photos,
      row_id,
   }
}

async function waitPrevDetailsContentToChange(row_id: string, viewIFrame: FrameLocator, detailIframe: FrameLocator) {
   const flexCode = await viewIFrame.locator(`tr#${row_id} .listnbrcontainer a#listingNumberAnchor`)
      .first().evaluate((el: HTMLElement) => el.innerText)

   await detailIframe.getByText(flexCode).isVisible()
}

async function scrapeUbicacionSection(detailIframe: FrameLocator) {

   return detailIframe.locator("table.style20080305202843445493000000").evaluate(el => {

      let flex_code = ""

      const ubicacion: { [k: string]: string } = {}

      const kElemS = el.querySelectorAll(`td.datalabelfont.style20080305202843639362000000`)

      for (const kElem of kElemS) {
         let k = kElem.textContent
         const valElem = kElem.nextSibling as HTMLElement
         const val = valElem.innerText
         if (!k) continue
         if (!val) continue
         if (k === "Codigo de Inmueble:") {
            flex_code = val
            continue
         }

         ubicacion[k] = val
      }

      return { flex_code, ubicacion }
   })
}

async function scrapeDireccionSection(detailIframe: FrameLocator) {

   return detailIframe.locator("table.style20080305202843849962000000").evaluate(el => {

      let nombreDelInmueble = ""
      const direccion: string[] = []

      const kElemS = el.querySelectorAll(`span.datalabelfont.style20080305202843917733000000`)

      for (const kElem of kElemS) {
         let k = kElem.textContent!
         const val = kElem.nextSibling?.textContent
         if (!val) continue
         if (k === "Nombre de Inmueble") {
            nombreDelInmueble = val
            continue
         }
         direccion.push(val)
      }

      const direccionStr = direccion.join(" ")

      const data = {
         ["nombre del inmueble"]: nombreDelInmueble,
         ["direccion"]: direccionStr
      }

      return data
   })
}

async function scrapeDescripcionSection(detailIframe: FrameLocator) {

   return detailIframe.locator(`table.style20080305202843849962000000`).evaluate(el => {

      const data: { [k: string]: string } = {}

      const kElemS = el.querySelectorAll(`span.datalabelfont.style20080305202844068284000000`)

      for (const kElem of kElemS) {
         let k = kElem.textContent
         const valElem = kElem.nextSibling as HTMLElement
         const val = valElem.innerText
         if (!k) continue
         if (!val) continue
         data[k] = val
      }

      return data
   })
}

async function scrapeInfoGenSection(detailIframe: FrameLocator) {

   return detailIframe.getByText("Informacion General").evaluate(el => {

      const tbody = el.nextSibling?.childNodes[0]
      // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
      const trS = tbody?.childNodes!

      const data: { [k: string]: string } = {}

      for (const tr of trS) {
         const tdS = tr.childNodes

         let k: string | undefined = undefined

         for (const td_ of tdS) {
            const td = td_ as HTMLElement
            if (!k) {
               k = td.innerText
               continue
            }
            const val = td.innerText
            if (!val) continue
            data[k] = val
            k = undefined
         }
      }

      return data
   })
}

async function scrapeDetallesSection(detailIframe: FrameLocator) {

   const scraped = await detailIframe.locator(`table.style20080305202843849962000000`).evaluate(el => {
      const kElemS = el.querySelectorAll(`td.style20080305202844557512000000`)
      return [...kElemS]
         .map(el => {
            const el_ = el as HTMLElement
            return el_.innerText
         })
         .join("; ")
   })

   let data: { [k: string]: string } = {}

   for (const kVals of scraped.split("; ")) {
      const pair = kVals.split(": ")
      const k = pair[0] as string
      if (pair.length === 1) {
         data[k] = "Si"
         continue
      }
      const val = pair[1] as string
      data[k] = val
   }

   return data
}

async function scrapeInfoInternaSection(detailIframe: FrameLocator) {

   return detailIframe.getByText("Informacion Interna").evaluate(el => {

      const tbody = el.nextSibling?.childNodes[0]
      // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
      const trS = tbody?.childNodes!

      const data: { [k: string]: string } = {}

      for (const tr of trS) {
         const tdS = tr.childNodes

         let k: string | undefined = undefined

         for (const td_ of tdS) {
            const td = td_ as HTMLElement
            if (!k) {
               k = td.innerText
               continue
            }
            const val = td.innerText
            if (!val) continue
            data[k] = val
            k = undefined
         }
      }

      return data
   })
}

async function scrapePhotosData(viewIFrame: FrameLocator, row_id: string, photosIframe: FrameLocator) {

   const rowPhotoThumbnailSrc = await viewIFrame.locator(`#${row_id} .gridonelineplaceholdercolumn.photocell img.gridtd-photo`).getAttribute("src")
   /* Wait until same photo is present in carousel */
   await photosIframe.locator(`.rsThumbsContainer div[style*="${rowPhotoThumbnailSrc}"]`).waitFor()

   return photosIframe.locator(".rsThumbsContainer").evaluate(el => {

      let photosIDs: string[] = []

      const photoThumbsDivs = el.querySelectorAll(".rsTmb.photo ")

      for (const div of photoThumbsDivs) {
         const style = div.getAttribute("style")

         if (!style) {
            continue
         }

         const photoID = style.match(new RegExp(`/ven/(.*?).jpg`))

         if (!photoID) {
            continue
         }

         photosIDs.push(photoID[1]!)
      }

      return photosIDs
   })
}


/* Utils */

async function findRowIDToScrapeFrom(viewIFrame: FrameLocator, dbRowID: string) {

   if (dbRowID === "0") {
      const row = await viewIFrame.locator(`#thegridbody > tr`).nth(0).getAttribute("id")
      if (!row) {
         throw Error("Could not find initialized row-id")
      }
      return row
   }

   return findNextRowID()

   // helpers
   async function findNextRowID(): Promise<string> {
      try {
         // need to find DBRow first in case it is the last of loaded rows (css sibling would fail)
         await viewIFrame.locator(`tr#${dbRowID}`).waitFor({ timeout: 20 })
         const isLast = await isTrLastofList(dbRowID, viewIFrame)
         if (isLast) {
            await scrollListDownAndWaitNewLoadedListings(viewIFrame)
            const newRowID = await viewIFrame.locator(`tr#${dbRowID} + tr`).getAttribute("id")
            if (newRowID === null) {
               throw Error("Locating row_id")
            }
            return newRowID
         }
         const newRowID = await viewIFrame.locator(`tr#${dbRowID} + tr`).getAttribute("id")
         if (newRowID === null) {
            throw Error("Locating row_id")
         }
         return newRowID
      }
      catch (e) {
         if (e instanceof Error && e.name === "TimeoutError") {
            await scrollListDownAndWaitNewLoadedListings(viewIFrame)
            const newRowID = await findNextRowID()
            return newRowID
         }
         throw e
      }
   }
}

function getNextSiblingTrRowID(row_id: string, viewIFrame: FrameLocator) {
   return viewIFrame.locator(`#${row_id} + tr`).getAttribute("id")
}

/* Returns true is spinner didn't appear, ie, all listings were scraped */
async function scrollListDownAndWaitNewLoadedListings(viewIFrame: FrameLocator) {

   await viewIFrame.locator(`#gridC`).evaluate(letfListElem => {
      letfListElem.scroll(0, 300_00)
   })

   try {
      await viewIFrame.locator(`#morelistingsbot`).getByText("more listings ").isVisible({ timeout: 500 })
   }
   catch (e) {
      if (e instanceof Error && e.name === "TimeoutError") {
         return true
      }
      throw e
   }

   await viewIFrame.locator(`#morelistingsbot`).getByText("more listings ").isHidden()

   // await viewIFrame.locator(`#gridC`).evaluate(async letfListElem => {

   //    let resolve: (value: unknown) => void
   //    const promise = new Promise(res => {
   //       resolve = res
   //    })

   //    letfListElem.addEventListener("scroll", () => {
   //       resolve(undefined)
   //    }, { once: true })

   //    await promise
   // })

   return false
}

async function isTrLastofList(row_id: string, viewIFrame: FrameLocator) {
   return viewIFrame.locator(`#thegridbody`).evaluate((el, row_id) => {

      const targetTr = el.querySelector(`#${row_id}`)!
      const childrenArr = [...el.children]
      const index = childrenArr.indexOf(targetTr)
      return (childrenArr.length - 1) === index ? true : false

   }, row_id)
}

async function cleanResources() {
   console.log("Cleaning Resources")
   await browserCtx.close()
   await browser.close()
   await db.terminate()
}


/* DB stuff */

async function getDBResources() {

   const db = new Firestore({
      projectId: "lofty-foundry-424913-q8",
      keyFilename: "./secrets/firestore-listings-certs.json",
      databaseId: "fellowmls-scraped-1",
   })

   const rowIDDocData = (await db.collection("meta").doc("tr_row_id").get()).data()
   const dbRowID = rowIDDocData as { row_id: string }

   return { db, dbRowID: dbRowID.row_id }
}

async function updateDB(batchListingScraped: ListingScraped[], row_id: string, db: Firestore) {

   const listingsColl = db.collection("listings")
   const rowIDDoc = db.collection("meta").doc("tr_row_id")

   const batch = db.batch()
   for (const listingSraped of batchListingScraped) {
      batch.create(listingsColl.doc(listingSraped.flex_code), listingSraped)
   }
   batch.update(rowIDDoc, {row_id})
   await batch.commit()
}




/* Types */

type ListingScraped = {
   row_id: string,
   flex_code: string,
   ubicacion: { [k: string]: string },
   direccion: { [k: string]: string },
   descripcion: { [k: string]: string },
   info_general: { [k: string]: string },
   detalles: { [k: string]: string },
   info_interna: { [k: string]: string },
   photos: string[],
}