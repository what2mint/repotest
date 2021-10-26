"use strict"

// core
const { promisify } = require("util")
const { rename, readFile, writeFile } = require('fs').promises
const { createHash } = require('crypto')

// npm
const ejs = require("ejs")
const CleanCSS = require("clean-css")
const { build } = require('esbuild')

// self
const data = require("../config.json")

const re = /[^a-z0-9]+/g
const renderFile = promisify(ejs.renderFile)
const miniCss = new CleanCSS({ returnPromise: true })

const files = {
  js: "src/dist/all.js",
  css: "src/dist/styles.css",
}

const sig = (fn) => readFile(fn, "utf-8")
  .then((fc) => createHash('sha256').update(fc)
      .digest("base64")
      .toLowerCase()
      .replace(re, '')
      .slice(0, 6)
  )

Promise.all([
  sig(files.js),
  sig(files.css),
])
.then(([sigJs, sigCss]) => {
  const filenameJs = `src/dist/all.${sigJs}.js`
  const filenameCss = `src/dist/styles.${sigCss}.css`
  return Promise.all([
    renderFile(
      "src/templates/index.html",
      { ...data, sigJs, sigCss }
    ),
    filenameJs,
    filenameCss,
    rename("src/dist/all.js", filenameJs),
    rename("src/dist/styles.css", filenameCss),
  ])
})
.then(async ([html, filenameJs, filenameCss]) => {
  const p = [
    readFile(filenameCss, "utf-8"),
    filenameCss,
  ]

  // FIXME: don't minify on Mac due to esbuild bug
  if (process.platform !== "darwin") p.push(
    build({
      entryPoints: [filenameJs],
      outfile: filenameJs.replace(/^src\//, "prod/"),
      minify: true,
    })
  )
  p.push(writeFile("src/index.html", html))

  return Promise.all(p)
})
.then(([css, filenameCss]) => Promise.all([
  miniCss.minify(css),
  filenameCss,
]))
.then(([{ stats, styles }, filenameCss]) => {
  const p = [
    stats,
  ]
  if (process.platform !== "darwin") p.push(
    writeFile(filenameCss.replace(/^src\//, "prod/"), styles)
  )

  return Promise.all(p)
})
.then(([stats]) => console.log("css-stats", stats))
.catch(console.error)
