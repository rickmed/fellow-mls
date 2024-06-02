import { chromium, type BrowserContext, type Browser, FrameLocator, Locator } from "playwright"
import { Firestore } from "@google-cloud/firestore"
import { sleep } from "./utils.mjs"


const timeout = 20_000
let browser!: Browser
let browserCtx!: BrowserContext
let db!: Firestore
let timeoutRetries = 3


try {
   await main()
}
catch (e) {
   if (e instanceof Error && e.name === "TimeoutError" && timeoutRetries > 0) {
      --timeoutRetries
      console.log("Got a TimeoutError.", e)
      console.log("Retrying:", {timeoutRetries})
      await cleanResources()
      await main()
   }
   else {
      console.log("An Unexpected error was thrown.", e)
      await cleanResources()
      console.log("Program Ending.")
   }
}


/* Main */

async function main() {

   const dbRsrcS = await getDBResources()
   db = dbRsrcS.db
   let { schema } = dbRsrcS.metaData

   browser = await chromium.launch({ headless: false, timeout })
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

   /* Sort estates MLS# descending (from newest inserted to oldest) */
   await viewIFrame.locator(`#header_for_grid`).getByText(`MLS #`).click()
   await viewIFrame.locator(`#dropmenudiv`).getByText(`Sort Descending`).click()
   await viewIFrame.locator("#firsttimeindiv_innerds").getByText("Loading ").waitFor()
   await viewIFrame.locator("#firsttimeindiv_innerds").getByText("Loading ").isHidden()

   let row_id = await findRowID(viewIFrame, dbRsrcS.metaData.tr_row_id)
   let batchEstateScraped: EstateScraped[] = []

   // eslint-disable-next-line no-constant-condition
   while (true) {

      try {
         // eslint-disable-next-line no-var
         var estateScraped: EstateScraped = await scrapeEstate(row_id, viewIFrame, detailButton, detailIFrame, photosButton, photosIFrame)
         console.log(row_id)
         console.log(estateScraped.flex_code)
         console.log(estateScraped.photos[0])
         console.log(estateScraped)
         console.log("\n")
      }
      catch (e) {
         if (e instanceof Error && e.name === "Error" && e.message === "locator.evaluate: Execution context was destroyed, most likely because of a navigation") {
            console.log("An evaluator failed. Retrying row_id.", { row_id })
            continue
         }
         throw e
      }

      batchEstateScraped.push(estateScraped)
      if (batchEstateScraped.length === 2) {
         const schemaChanged = updateSchema(schema, batchEstateScraped)
         // console.log({batchEstateScraped, schemaChanged, schema})
         // await updateDB(batchEstateScraped, row_id, db, schemaChanged ? schema : undefined)
         batchEstateScraped = []
      }

      const isTrLast = await isTrLastofList(row_id, viewIFrame)
      if (isTrLast) {
         const allEstatesScraped = await scrollListDownAndWaitNewLoadedEstates(viewIFrame)
         if (allEstatesScraped) {
            break
         }
      }

      const newRowID = await getNextSiblingRowID(row_id, viewIFrame)
      if (!newRowID) {
         throw Error("FellowMLS. newRowId not found.")
      }

      row_id = newRowID
   }

   console.log("All scraping done. Program Ending")
   await cleanResources()
}


/* Scrape Estates */

async function scrapeEstate(row_id: string, viewIFrame: FrameLocator, detailsButton: Locator, detailIframe: FrameLocator, photosButton: Locator, photosIframe: FrameLocator) {

   // click correct item of list
   await viewIFrame.locator(`#${row_id}`).click()
   await detailsButton.click()
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
   await detailsButton.click()

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
}


/* Utils */

async function findRowID(viewIFrame: FrameLocator, dbRowID: string) {

   if (dbRowID === "0") {
      const row = await viewIFrame.locator(`#thegridbody > tr`).nth(0).getAttribute("id")
      if (!row) {
         throw Error("Could not find initialized row-id")
      }
      return row
   }

   return scrollUntilRowIDFound()

   // helpers
   async function scrollUntilRowIDFound(): Promise<string> {
      // need to check dbRowID is the one returned by locator
      try {
         // eslint-disable-next-line no-var
         var gotRowID = await viewIFrame.locator(`tr#${dbRowID}`).getAttribute("id", { timeout: 20 })
         return assertGotRowIDIsCorrect(gotRowID)
      }
      catch (e) {
         if (e instanceof Error && e.name === "TimeoutError") {
            await scrollListDownAndWaitNewLoadedEstates(viewIFrame)
            const gotRowID = await scrollUntilRowIDFound()
            return assertGotRowIDIsCorrect(gotRowID)
         }
         throw e
      }
   }

   function assertGotRowIDIsCorrect(gotRowID: string | null) {
      if (gotRowID == null) {
         throw Error(`Got null when finding rowID`)
      }
      if (gotRowID !== dbRowID) {
         throw Error(`Got rowID from scraping is different from dbRowID; gotRowID: ${gotRowID}, dbRowID: ${dbRowID}}}`)
      }
      return gotRowID
   }
}

function getNextSiblingRowID(row_id: string, viewIFrame: FrameLocator) {
   return viewIFrame.locator(`#${row_id} + tr`).getAttribute("id")
}

/* returns true is spinner didn't appear, ie, all estates we scraped */
async function scrollListDownAndWaitNewLoadedEstates(viewIFrame: FrameLocator) {

   await viewIFrame.locator(`#gridC`).evaluate(letfListElem => {
      letfListElem.scroll(0, 300_00)
   })

   try {
      await viewIFrame.locator(`#morelistingsbot`).waitFor({ timeout: 500 })
   }
   catch (e) {
      if (e instanceof Error && e.name === "TimeoutError") {
         return true
      }
      throw e
   }

   await viewIFrame.locator(`#gridC`).evaluate(async letfListElem => {

      let resolve: (value: unknown) => void
      const promise = new Promise(res => {
         resolve = res
      })

      letfListElem.addEventListener("scroll", () => {
         resolve(undefined)
      }, { once: true })

      await promise
   })

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
      keyFilename: "./secrets/firestore-estates-certs.json",
      databaseId: "fellowmls-scraped-1",
   })

   const metaDBData = (await db.collection("meta").doc("meta").get()).data()
   const metaData = metaDBData as { schema: EstateSchema, tr_row_id: string }

   return { db, metaData }
}

async function updateDB(batchEstateScraped: EstateScraped[], row_id: string, db: Firestore, schema?: EstateSchema) {

   console.log({ batchData: batchEstateScraped.map(x => x.flex_code) })
   const estatesColl = db.collection("estates")
   const metaDoc = db.collection("meta").doc("meta")

   const newMetaData = schema ? { schema, row_id } : { row_id }

   const batch = db.batch()
   for (const estateSraped of batchEstateScraped) {
      batch.create(estatesColl.doc(estateSraped.flex_code), estateSraped)
   }
   batch.update(metaDoc, newMetaData)
   await batch.commit()
}

/* Returns true if schema changed; false, otherwise */
function updateSchema(schema: EstateSchema, batchEstateScraped: EstateScraped[]): boolean {

   let schemaChanged = false

   for (const estateScraped of batchEstateScraped) {
      const schemaChanged_ = singleEstateScrapedpdateSchema(estateScraped)
      if (schemaChanged_) {
         schemaChanged = true
      }
   }

   return schemaChanged

   // helpers
   function singleEstateScrapedpdateSchema(estateScraped: EstateScraped) {
      const schemafields = schema.map(x => x.field_name)
      let schemaChanged = false

      for (const k in estateScraped) {
         if (k === "photos" || k === "flex_code") {
            continue
         }
         if (k === "ubicacion" || k === "direccion" || k === "descripcion" || k === "info_general" || k === "detalles" || k === "info_interna") {
            const scrapedData = estateScraped[k]

            for (const field_name of Object.keys(scrapedData)) {
               if (!schemafields.includes(field_name)) {
                  schemaChanged = true
                  schema.push({
                     field_name,
                     last_seen_val: scrapedData[field_name] as string,
                     og_section: k
                  })
               }
            }
         }
      }

      return schemaChanged
   }
}


/* Types */

type EstateScraped = {
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

type OgSection =
   "ubicacion" | "direccion" | "descripcion" |
   "info_general" | "detalles" | "info_interna"

type SchemaLeaf = {
   field_name: string,
   last_seen_val: string,
   og_section: OgSection,
}

type EstateSchema = SchemaLeaf[]