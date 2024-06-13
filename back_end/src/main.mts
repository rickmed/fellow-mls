import express from "express"
import { RequestHandler } from "express"

const port = 3000
const app = express()

app.get("/", (async (req, res) => {
   await Promise.resolve(1)
   const url = req.url
   res.status(200).send(`hello: ${url}`)
}) as RequestHandler)

app.get("/epa", (async (req, res) => {
   await Promise.resolve(1)
   const url = req.url
   res.status(200).send(`epa: ${url}`)
}) as RequestHandler)

app.get("/error", (async (req, res) => {
   await Promise.resolve(1)
   const url = req.url
   res.status(404).json({data: []})
}) as RequestHandler)

app.listen(port, () => {
   console.log("server started at port", port)
})
