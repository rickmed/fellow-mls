import { Firestore } from "@google-cloud/firestore"
import {ListingScraped, ListingsSchema, SchemaLeaf, updateSchema} from "./schema.mjs"

const db = new Firestore({
   projectId: "lofty-foundry-424913-q8",
   keyFilename: "./secrets/firestore-listings-certs.json",
   databaseId: "fellowmls-scraped-1",
})


const schemaData = await db.collection("meta").doc("schema").get()

type DataItem = {db_column: string, last_seen_val: string, og_section: string}
type Data = DataItem[]

const data = schemaData.data()!.schema as Data

console.log()

let things: Array<[string, string, string]> = []

for (const column of data) {
   const thing: [string, string, string] = [column.og_section, column.db_column, column.last_seen_val]
   things.push(thing)
}

console.log(things)