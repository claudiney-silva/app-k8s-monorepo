const express = require('express')
const app = express()
const port = 3000

app.get('/', (req, res) => {
  res.send(`{"message": "Server running!", "version": "1", "date": "${Date.now()}"}`)
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})