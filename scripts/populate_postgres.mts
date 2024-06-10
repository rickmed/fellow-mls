import { Firestore } from "@google-cloud/firestore"
import pg from "pg"
import { pg_config } from "../secrets/pg_config.js"

const frStr = new Firestore({
   projectId: "lofty-foundry-424913-q8",
   keyFilename: "./secrets/firestore-listings-certs.json",
   databaseId: "fellowmls-scraped-1",
})

type SchemaItem = {
   field_name: string,
   db_column: string,
   last_seen_val: string,
   og_section: string
}
type Schema = SchemaItem[]


type StrStrObj = {
   [field_name: string]: string
}

type Listing = {
   row_id: string,
   flex_code: string,
   ubicacion: StrStrObj,
   direccion: StrStrObj,
   descripcion: StrStrObj,
   info_general: StrStrObj,
   detalles: StrStrObj,
   info_interna: StrStrObj,
   photos: string[],
}

type ListingS = Listing[]

const [listingsDocs, schemaDoc] = await Promise.all([frStr.collection("listings").get(), frStr.collection("meta").doc("schema").get()])
const listingS = listingsDocs.docs.map(d => d.data()) as ListingS
const schema = schemaDoc.data()!.schema as Schema

const wrangledListingS = listingS.map(wrangleListing)
   .filter(l => {
      const code = l.flex_code
      if (code == "24-23416" || code === "24-23423" || code === "24-23585" || code === "24-23630" || code === "24-23719" || code === "24-24463" || code === "24-26240" || code === "24-27004") {
         return true
      }
      return false
    })

const { Pool } = pg
const pool = new Pool(pg_config)

let saved = 0
let notSavedBcErr: string[] = []

for (const l of wrangledListingS) {
   const queryStr = objQueryStr(l)
   try {
      await pool.query(queryStr)
   }
   catch (e) {
      console.log(queryStr)
      console.log("Err", e)
      notSavedBcErr.push(l.flex_code)
   }
   saved++
   console.log(saved)
}

console.log(notSavedBcErr)

await pool.end()


//* **********  Helpers  ********** *//

type WrangledListing = {
   row_id: string,
   flex_code: string,
   ubicacion: {[k: string]: string | number},
   direccion: {[k: string]: string | number},
   descripcion: {[k: string]: string | number},
   info_general: {[k: string]: string | number},
   detalles: {[k: string]: string | number},
   info_interna: {[k: string]: string | number},
   photos: string[],
}

function wrangleListing(listing: Listing) {

   const wrangledLst: WrangledListing = {...listing}

   for (const k in listing) {
      if (k === "ubicacion" || k === "direccion" || k === "descripcion" ||
         k === "info_general" || k === "detalles" || k === "info_interna") {

            const subObj = listing[k]
            let newSubObj: {[k: string]: string | number} = {}

            for (const k in subObj) {
               const column_name = schemaDBKey(k)
               const cn = column_name
               const subObjKVal = subObj[k]!
               if (subObjKVal === "" || subObjKVal === " " || subObjKVal === " ") {
                  continue
               }
               if (cn === "precio" || cn === "precio_original" || cn === "precio_actual" || cn === "precio_minimo") {
                  const newVal = subObjKVal.replaceAll(",", "")
                  const res = parseInt(newVal)
                  if (isNaN(res)) {
                     newSubObj[column_name] = subObjKVal
                     continue
                  }
                  newSubObj[column_name] = res
                  continue
               }
               if (cn === "cambio_estado" || cn === "fecha_reactivacion" || cn === "fecha_inicio" || cn === "fecha_vencimiento") {
                  const newVal = wrangleDate(subObjKVal)
                  newSubObj[column_name] = newVal
                  continue
               }

               newSubObj[column_name] = subObjKVal.replaceAll(`'`, `''`)
            }

            wrangledLst[k] = newSubObj
         }
   }

   return wrangledLst

   //
   function wrangleDate(v: string) {
      const [month, day, year] = v.split("/")
      return `${year}-${month}-${day}`
   }
}

function schemaDBKey(scrapedK: string) {
   const kSchemaObj = schema.find(o => o.field_name === scrapedK)!
   const column_name = kSchemaObj.db_column
   return column_name
}

/*
out:

   BEGIN; \
   CREATE TEMP TABLE temp(listing_id INT); \

   WITH inserted AS (
      INSERT INTO listing
         (flex_code, row_id) VALUES
         ('${flex_code}', '${row_id}')
      RETURNING listing_id
   )
   INSERT INTO temp SELECT listing_id FROM inserted; \

   INSERT INTO photo (flex_id, listing_id) VALUES
   	('str1', (SELECT listing_id FROM temp_ins)),
      ('str2', (SELECT listing_id FROM temp_ins)),
      ('str3', (SELECT listing_id FROM temp_ins)); \

   INSERT INTO direccion (nombre_del_inmueble, direccion, listing_id)
   SELECT 'str1', 'str2', listing_id FROM temp; \

   INSERT INTO descripcion (descripcion, como_llegar, observaciones, listing_id)
   SELECT 'str1', 'str2', 'str3' listing_id FROM temp; \

   DROP TABLE temp; \
   COMMIT;

*/
function objQueryStr(listing: WrangledListing) {
   const headerStr = primObjStr(listing)
   const photosStr = photosQueryStr(listing.photos)
   const subObjKs = Object.keys(listing)
      .filter(k => k === "ubicacion" || k === "direccion" || k === "descripcion" ||
         k === "info_general" || k === "detalles" || k === "info_interna")

   const subObjsStrs = subObjKs.map(k => subObjQueryStr(listing, k as keyof Listing))

   const footerStr = `
DROP TABLE temp;
COMMIT;
   `
   return headerStr + "\n" + photosStr + "\n\n" + subObjsStrs.join("\n\n") + "\n" + footerStr
}

function primObjStr(listing: WrangledListing) {
   const {flex_code, row_id} = listing

   const str =  `
BEGIN;
CREATE TEMP TABLE temp(listing_id INT);

WITH inserted AS (
   INSERT INTO listing
      (flex_code, row_id) VALUES
      ('${flex_code}', '${row_id}')
   RETURNING listing_id
)
INSERT INTO temp SELECT listing_id FROM inserted;
   `
   return str
}


/*
out:
INSERT INTO <objK> (subk1, subk2, subk3)
SELECT 'val1', 'val2', 'val3', listing_id FROM temp; \
*/
function subObjQueryStr(obj: WrangledListing, objK: keyof WrangledListing) {
   const subObj = obj[objK]
   const subKeys = Object.keys(subObj)
   const subVals = Object.values(subObj)

   const firstLn = `INSERT INTO ${objK} ` + "(" + subKeys.join(", ") + ", listing_id" + ")"
   const secondLn = `SELECT ` + subVals.map(v => `'${v}'`).join(", ") + `, listing_id FROM temp;`

   return firstLn + "\n" + secondLn
}


/*
in:
["str1", "str2", "str3"]

out:
INSERT INTO photo (flex_id, listing_id) VALUES
('str1', (SELECT listing_id FROM temp_ins)),
('str2', (SELECT listing_id FROM temp_ins)),
('str3', (SELECT listing_id FROM temp_ins));

*/
function photosQueryStr(photos: string[]) {
   const headerStr = `INSERT INTO photo (flex_id, listing_id) VALUES`
   const valuesStr =  photos.map(p => singleValStr(p)).join(", \n") + ";"
   return headerStr + "\n" + valuesStr

   function singleValStr(x: string) {
      return `('${x}', (SELECT listing_id FROM temp))`
   }
}
