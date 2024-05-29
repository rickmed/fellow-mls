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
   await topFrame.locator(`#bookmarkMenuItems *[data-id="QuickSearch"]`).click()
   const viewFrame = topFrame.frameLocator(`#view_frame`)
   await viewFrame.locator(`#enabled_6`)
   .selectOption(['Abejales', 'Achaguas']);
   // .locator(`#inputform`).focus()
   //  .locator(`#enabled_6`).innerHTML()
   // .click()
// console.log({x})



   // // ciudad
   // await page.locator(`#enabled_6`).click()
   // // urbanizacion
   // await page.locator(`#enabled_7`).click()

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