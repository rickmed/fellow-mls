import { chromium, type BrowserContext, type Browser, FrameLocator, Locator } from "playwright"
import {sleep} from "./utils.mjs"

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

   page.on("console", msg => {
      const msg_ = msg.text()
      if (msg_.includes("FMLS")) {
         console.log(msg_)
      }
   })

   await page.goto(`https://ven.flexmls.com/`)

   await page.locator("#user").fill(`ven.anarodriguez`)
   await page.locator(`#login-button`).click()

   await page.locator(`#password`).fill(`Manuelm87`)
   await page.locator(`#login-button`).click()

   const topIFrame = page.frameLocator(`#top_frame`)
   const viewIFrame = topIFrame.frameLocator(`#view_frame`)

   /* Open listings of Zonas Anais saved search */
   await topIFrame.locator(`#bookmarkMenuItems *[data-id="SavedSearches"]`).click()
   await viewIFrame.getByText("Zona Anais").click()

   // Wait list to load
   await viewIFrame.locator(`#thegridbody`).waitFor()

   /* Locators used in program */
   const detailButton = viewIFrame.locator(`#tab_detail`)
   const detailIFrame = viewIFrame.frameLocator(`#iframe_detail`)
   const photosButton = viewIFrame.locator(`#tab_tour`)
   const photosIFrame = viewIFrame.frameLocator(`#iframe_tour`)

   /* Sort estates MLS# descending (from newest inserted to oldest) */
   /*    await viewIFrame.locator(`#thegridbody`).waitFor()
      await viewIFrame.locator(`#header_for_grid`).getByText(`MLS #`).click()
      await viewIFrame.locator(`#dropmenudiv`).getByText(`Sort Descending`).click() */

   // from db or:
   let row_id = await viewIFrame.locator(`#thegridbody > tr`).nth(0).getAttribute("id")
   if (!row_id) {
      throw Error("FellowMLS. row_id not found at init")
   }

   let scraped = 0

   // click correct item of list
   await viewIFrame.locator(`#${row_id}`).click()
   await detailButton.click()
   // await sleep(2_000)

   const things = await scrapeDescripcionSection(detailIFrame)
   console.log({things})


   // // eslint-disable-next-line no-constant-condition
   // while (true) {
   //    console.log("SCRAPING:", row_id)
   //    const estateData = await scrapeEstate(row_id, viewIFrame, detailsButton, detailsIFrame, photosButton, photosIFrame)

   //    const toDB = {...estateData, row_id}
   //    console.log(toDB)
   //    // save estateData to db, here

   //    const isTrLast = await isTrLastofList(row_id, viewIFrame)
   //    if (isTrLast) {
   //       const allEstatesScraped = await scrollListDownAndWaitNewLoadedEstates(viewIFrame)
   //       if (allEstatesScraped) {
   //          break
   //       }
   //    }

   //    const newRowID = await getNextSiblingRowID(row_id, viewIFrame)
   //    if (!newRowID) {
   //       throw Error("FellowMLS. newRowId not found.")
   //    }
   //    row_id = newRowID

   //    scraped++
   //    console.log({scraped})
   // }

   await cleanResources()
}

try {
   await main()
}
catch (e) {
   console.log("FellowMLS: something threw.")
   if (e instanceof Error) {
      console.log("An Error was thrown.")
      console.log("ERROR MSG:", e.message)
      console.log("ERROR:", e)
   }
   await cleanResources()
}


async function cleanResources() {
   console.log("Program Done")
   if (browserCtx) {
      await browserCtx.close()
   }
   if (browser) {
      await browser.close()
   }
}

function getNextSiblingRowID(row_id: string, viewIFrame: FrameLocator) {
   return viewIFrame.locator(`#${row_id} + tr`).getAttribute("id")
}

async function scrapeEstate(row_id: string, viewIFrame: FrameLocator, detailsButton: Locator, detailIframe: FrameLocator, photosButton: Locator, photosIframe: FrameLocator) {

   // click correct item of list
   await viewIFrame.locator(`#${row_id}`).click()
   await detailsButton.click()

   /* Srape Detail Data */
   const ubicacionData = await scrapeUbicacionSection(detailIframe)
   const direccionData = await scrapeDireccionSection(detailIframe)
   const descripcionData = await scrapeDescripcionSection(detailIframe)
   const infoGenData = await scrapeInfoGenSection(detailIframe)
   const detallesData = await scrapeDetallesSection(detailIframe)
   const infoInternaData = await scrapeInfoInternaGenSection(detailIframe)

   /* Srape Photos Data */
   await photosButton.click()
   const photosData = await scrapePhotosData(photosIframe)

   // so when next list tr is clicked, details page reloads all info inmediately.
   await detailsButton.click()

   return {
      ubicacionData,
      direccionData,
      descripcionData,
      infoGenData,
      detallesData,
      infoInternaData,
      photosData
   }
}

async function scrapeUbicacionSection(detailIframe: FrameLocator) {

   const ubicacionTable = detailIframe.locator(".style20080305202843445493000000").first()

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

   return { flexCode, ubicacionData }
}

async function scrapeDireccionSection(detailIframe: FrameLocator) {

   const direccionScraped = await detailIframe.getByText("Nombre de Inmueble").evaluate(el => {

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

async function scrapeDescripcionSection(detailIframe: FrameLocator) {

   const descripcionData = await detailIframe.locator(`table.style20080305202843849962000000`).evaluate(el => {

      const data: Array<[string, string]> = []

      const kElemS = el.querySelectorAll(`span.datalabelfont.style20080305202844068284000000`)

      for (const kElem of kElemS) {
         const k = kElem.textContent
         const val = kElem.nextSibling?.textContent
         if (!k) continue
         if (!val) continue
         data.push([k, val])
      }

      return data
   })

   return descripcionData
}

async function scrapeInfoGenSection(detailIframe: FrameLocator) {

   const infoGenScraped = await detailIframe.getByText("Informacion General").evaluate(el => {

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

async function scrapeDetallesSection(detailIframe: FrameLocator) {

   const detallesScraped = await detailIframe.getByText("Detalles Inmueble:").evaluate(el => {

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

async function scrapeInfoInternaGenSection(detailIframe: FrameLocator) {

   const infoGenScraped = await detailIframe.getByText("Informacion Interna").evaluate(el => {

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

async function scrapePhotosData(photosIframe: FrameLocator) {

   const photosIDs = await photosIframe
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
