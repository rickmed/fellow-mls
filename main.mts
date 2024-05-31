import { chromium, type BrowserContext, type Browser, FrameLocator, Locator } from "playwright"
import ts from "typescript"

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

   const topFrame = page.frameLocator(`#top_frame`)
   const viewFrame = topFrame.frameLocator(`#view_frame`)

   /* Open listings of Zonas Anais saved search */
   await topFrame.locator(`#bookmarkMenuItems *[data-id="SavedSearches"]`).click()
   await viewFrame.getByText("Zona Anais").click()

   await viewFrame.locator(`#thegridbody`).waitFor()

   const detailsButton = viewFrame.locator(`#tab_detail`)
   const detailsFrame = viewFrame.frameLocator(`#iframe_detail`)   // idem Photos
   const photosButton = viewFrame.locator(`#tab_tour`)
   const photosFrame = viewFrame.frameLocator(`#iframe_tour`)   // idem Photos

   /* Sort estates MLS# descending (from newest inserted to oldest) */
   /*    await viewFrame.locator(`#thegridbody`).waitFor()
      await viewFrame.locator(`#header_for_grid`).getByText(`MLS #`).click()
      await viewFrame.locator(`#dropmenudiv`).getByText(`Sort Descending`).click() */

   // const estateData = await scrapeEstate(0, leftList, detailsButton, detailsFrame, photosButton, photosFrame)

   // let estatesToScrape = true
   // while (estatesToScrape) {
   // }

   const rowIDs1 = await viewFrame.locator(`#thegridbody`).evaluate((el:HTMLElement) => {
      const trS = el.children
      let idS = []
      for (const tr of trS) {
         idS.push(tr.getAttribute("id"))
      }
      return idS
   })
   console.log({ rowIDs1 })

   const res = await scrollListDownAndWaitNewLoadedEstates(viewFrame)

   console.log({res})

   const rowIDs2 = await viewFrame.locator(`#thegridbody`).evaluate((el:HTMLElement) => {
      const trS = el.children
      let idS = []
      for (const tr of trS) {
         idS.push(tr.getAttribute("id"))
      }
      return idS
   })
   console.log({ rowIDs2 })


   // const sleepTime = 3_000
   // console.log("sleepin'", sleepTime)
   // await sleep(sleepTime)
   await cleanResources()
}

try {
   await main()
}
catch (e) {
   console.log("FellowMLS: something went wrong.")
   console.log(e)
   await cleanResources()
}


async function cleanResources() {
   console.log("Program Done")
   if (browserCtx) { await browserCtx.close() }
   if (browser) { await browser.close() }
}

function sleep(ms: number) {
   return new Promise(res => {
      setTimeout(res, ms)
   })
}

async function scrapeEstate(currTrIdx: number, viewFrame: FrameLocator, detailsButton: Locator, detailIframe: FrameLocator, photosButton: Locator, photosIframe: FrameLocator) {

   // click n item of leftList
   await viewFrame.locator(`#thegridbody > tr`).nth(currTrIdx).click()
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

   return { flexCode, ubicacionData }
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

      key = key.replace(":", "").replaceAll(" ", "")
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

async function scrapePhotosData(photosFrameLocator: FrameLocator) {

   const photosIDs = await photosFrameLocator
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

async function scrollListDownAndWaitNewLoadedEstates(viewFrame: FrameLocator) {

   await viewFrame.locator(`#gridC`).evaluate(letfListElem => {
      letfListElem.scroll(0, 300_00)
   })

   try {
      await viewFrame.locator(`#morelistingsbot`).waitFor({timeout: 500})
   }
   catch (e) {
      if (e instanceof Error && e.name === "TimeoutError") {
         return "end"
      }
   }

   await viewFrame.locator(`#gridC`).evaluate(async letfListElem => {

      let resolve: (value: unknown) => void
      const promise = new Promise(res => {
         resolve = res
      })

      letfListElem.addEventListener("scroll", () => {
         resolve(undefined)
      }, {once: true})

      await promise
   })
}

async function isItemLastInLeftList(currTrIdx: number, viewFrame: FrameLocator) {
   return viewFrame.locator(`#thegridbody`).evaluate((el, idx) => {
      const trSItems = el.children
      if ((trSItems.length - 1) == idx) {
         return true
      }
      return false
   }, currTrIdx)
}