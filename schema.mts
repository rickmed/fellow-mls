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

type OgSection =
   "ubicacion" | "direccion" | "descripcion" |
   "info_general" | "detalles" | "info_interna"

type SchemaLeaf = {
   field_name: string,
   last_seen_val: string,
   og_section: OgSection,
}

type ListingSchema = SchemaLeaf[]

/* Returns true if schema changed; false, otherwise */
function updateSchema(schema: ListingSchema, batchListingScraped: ListingScraped[]): boolean {

   let schemaChanged = false

   for (const listingScraped of batchListingScraped) {
      const schemaChanged_ = singleListingScrapedpdateSchema(listingScraped)
      if (schemaChanged_) {
         schemaChanged = true
      }
   }

   return schemaChanged

   // helpers
   function singleListingScrapedpdateSchema(listingScraped: ListingScraped) {
      const schemafields = schema.map(x => x.field_name)
      let schemaChanged = false

      for (const k in listingScraped) {
         if (k === "photos" || k === "flex_code") {
            continue
         }
         if (k === "ubicacion" || k === "direccion" || k === "descripcion" || k === "info_general" || k === "detalles" || k === "info_interna") {
            const scrapedData = listingScraped[k]

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