import { Firestore } from "@google-cloud/firestore"
import {ListingScraped, ListingsSchema, SchemaLeaf, updateSchema} from "./schema.mjs"

const db = new Firestore({
   projectId: "lofty-foundry-424913-q8",
   keyFilename: "./secrets/firestore-listings-certs.json",
   databaseId: "fellowmls-scraped-1",
})

const listingsColl = (await db.collection("listings").get())

let schema: ListingsSchema = []

for (const doc of listingsColl.docs) {
   const listing = doc.data() as ListingScraped
   updateSchema(schema, listing)
}

const specialCharsRg = /[^a-zA-Z0-9- ]/g

fieldsToPostgres()

const metaDoc = db.collection("meta").doc("schema")

await metaDoc.set({schema})


function fieldsToPostgres() {
   for (const field_ of schema) {
      const field = field_ as SchemaLeaf & {db_column: string}
      const fieldName = field.field_name
      const postgresFieldName = mangle(fieldName)
      field.db_column = postgresFieldName
   }
}


function mangle(field: string) {

   let str = field
   str = str.replaceAll(":", "").trim().toLowerCase()
   str = str.replaceAll("ñ", "n")
   str = str.replaceAll("#", "numero")
   str = str.replace(specialCharsRg, "")
   str = str.trim()
   str = str.replaceAll(" ", "_")
   return str
}