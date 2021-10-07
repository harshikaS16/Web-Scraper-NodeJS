const express = require("express");
const scraper = require('./scraper');

const app = express();

const port = process.env.PORT || 3000;

app.use('/test', scraper);

app.listen(port, function(){
    console.log("Server is listening to", port)
});