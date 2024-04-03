require("dotenv").config()
const multer = require("multer")
const mongoose = require("mongoose")
const bcrypt = require("bcrypt")
const File = require("./models/File")
const express = require("express")
const app = express()
const archiver = require('archiver')
const fs = require('fs')
const path = require('path')
const PORT = process.env.PORT || 3000

// Set the maximum file size limit
const MAX_FILE_SIZE = 2.5 * 1024 * 1024 * 1024

app.use(express.urlencoded({ extended: true }))
const upload = multer({
  dest: "uploads",
  limits: {
    fileSize: MAX_FILE_SIZE
  }
})

app.use(express.static('public'))

mongoose.connect(process.env.DATABASE_URL || "mongodb://127.0.0.1/fileS2")

app.set("view engine", "ejs")


app.get("/", (req, res) => {
  res.render("index")
})

app.post("/upload", upload.array("file"), async (req, res) => {
  const filePaths = req.files.map(file => file.path)
  const originalNames = req.files.map(file => file.originalname)

  const fileData = {
    path: filePaths,
    originalName: originalNames,
    maxDownloads: req.body.maxDownloads ? parseInt(req.body.maxDownloads) : 1
  }
  
  if(req.body.password != null && req.body.password !== "") {
    fileData.password = await bcrypt.hash(req.body.password, 10)
  }

  if(req.body.expirationTime) {
    const expirationTime = parseInt(req.body.expirationTime)
    fileData.expirationDate = new Date(Date.now() + expirationTime * 60 * 60 * 1000)
  }

  const file = await File.create(fileData)
  res.render("index", { fileLink: `${req.headers.origin}/file/${file.id}` })
})

app.get("/file/:id", handleFileInfo)
app.get("/file/:id/download", handleDownload)

app.post("/file/:id/password", async (req, res) => {
  const file = await File.findById(req.params.id)
  const enteredPassword = req.body.password

  //check if the file has a password set
  if(!file.password) {
    return res.render("fileDownload", { file })
  }

  // check if the entered password is not empty
  if(!enteredPassword) {
    //render an error message or redirect back to the password prompt
    return res.render("passwordPrompt", { fileId: file.id, error: "Please enter a password" })
  }
  const passwordMatch = await bcrypt.compare(enteredPassword, file.password)

  if(passwordMatch) {
    return res.render("fileDownload", { file })
  } else {
    return res.render("passwordPrompt", { fileId: file.id, error: "Invalid password" })
  }

})

async function handleFileInfo(req, res) {
  const file = await File.findById(req.params.id)

  // Check if file has expired
  if(file.expirationDate < new Date()) {
    return res.status(404).render("error", { message: "File has expired." })
  }

  // check if file has a password set
  if(file.password) {
    return res.render("passwordPrompt", { fileId: file.id})
  }

  // Render the file download page
  res.render("fileDownload", { file })
}

async function handleDownload(req, res) {
  const file = await File.findById(req.params.id)

  // Check if file has expired
  if(file.expirationDate < new Date()) {
    return res.status(404).render("error", { message: "File has expired." })
  }

  // Check if max downloads limit has been reached
  if(file.downloadCount >= file.maxDownloads) {
    return res.status(404).render("error", { message: "Maximum download limit reached." })
  }

  const zipName = `${file.originalName.join(', ')}.zip`
  res.status(200).attachment(zipName)

  const archive = archiver('zip')
  archive.pipe(res)

  const filePaths = file.path.map(filePath => path.join(__dirname, filePath));
  for(const filePath of filePaths) {
    const fileStream = fs.createReadStream(filePath)
    archive.append(fileStream, { name: path.basename(filePath) });
  }

  archive.finalize()

  file.downloadCount++
  await file.save()
}

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})