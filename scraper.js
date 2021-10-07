const express = require("express");
const request = require("request-promise");
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const router = express.Router();
const fs = require("fs");
const _ = require("underscore");
const Promise = require("bluebird");
const path = require("path");

var urlCollection = {
    "urls": []
};

router.get('/web-scraper', (req, res) => {
    service("https://medium.com")  //service("https://pirple.thinkific.com")
    .then(()=>{
        console.log("Final collection size: ",urlCollection.urls.length);
        fs.readFile('collection.json', function(err, content){
            res.write(content);
            res.end();
        });
    });
})  

/**
 * Function to carry out the entire scraping process
 * @param {String} url 
 */
function service(url){
    return scraperFn(url)
    .then(collection => {
        return createBatches(collection);
    }).then( batches => {
        return executeBatches(batches);
    }).then( () => {
        console.log("Scraping done");
        let stringJson = JSON.stringify(urlCollection);
        fs.writeFile("collection.json", stringJson, ()=>{
            return null;
        });
    })
}

/**
 * Function to scrape the web page and return an array of urls
 * @param {Array} url 
 */
function scraperFn(url) {
    return request({
        'url':url,
        'headers': {
            'Connection': 'keep-alive'
        }
    })
        .then((html) => {
            console.log("Current collection size: ", urlCollection.urls.length)
            if (html) {
                let doc = new JSDOM(html).window.document;
                let tempArray = [];
                for (let i = 0; i < doc.querySelectorAll('a').length; i++) {
                    tempArray.push(doc.querySelectorAll('a')[i].href);
                }

                //Filtering to avoid infinite looping
                var filtered = _.reject(tempArray, function (item) {
                    return item === "https://medium.com/" ;  //return item === "https://pirple.thinkific.com/"
                });

                //Filtering out the urls for css files and external links 
                var noCssFiltered = _.reject(filtered, function (item){
                   return item.includes("css") || !item.includes("https://medium.com");  //return item.includes("css") || !item.includes("https://pirple.thinkific.com")
                });

                //Filtering out any duplicate links
                var uniqueArray = _.uniq(noCssFiltered);

                //Filters out the links already captured from other pages
                var comparedArray = uniqueArray.filter((item) => {
                    var check = _.indexOf(urlCollection.urls, item) == -1 ? true : false;
                    if (check) {
                        return item;
                    }
                });

                urlCollection.urls.push.apply(urlCollection.urls, comparedArray);
                return Promise.resolve(comparedArray);
            }
            else {
                return Promise.reject(error);
            }
        }).catch(err => {
            console.log(err);
        })
}

/**
 * Create batches of 5 links for parallel execution 
 * @param {Array} collection
 */
function createBatches(collection) {
        let startIndex = 0;
        let endIndex = 4;
        let batchSeries = [];
        let iterations = Math.round(collection.length / 5) + 1;
        for (let i = 0; i < iterations; i++) {
            if (i != (iterations - 1)) {
                let parallelCalls = [];
                for (startIndex; startIndex <= endIndex; startIndex++) {
                    parallelCalls.push(collection[startIndex]);
                }
                batchSeries.push(parallelCalls);
                endIndex = startIndex + 4;
            } else {
                let parallelCalls = [];
                for (startIndex = 1; startIndex <= (collection.length % 5); startIndex++) {
                    parallelCalls.push(collection[startIndex]);
                }
                batchSeries.push(parallelCalls);
            }
        }
        return Promise.resolve(batchSeries);
}

/**
 * Executing batches of 5 calls at a time in series returning new links
 * @param {Array} batchSeries 
 */
function executeBatches(batchSeries) {
    return Promise.mapSeries(batchSeries, (parallelArray) => {
        return Promise.all([
            parallelArray[0] ? scraperFn(parallelArray[0]) : Promise.resolve(null),
            parallelArray[1] ? scraperFn(parallelArray[1]) : Promise.resolve(null),
            parallelArray[2] ? scraperFn(parallelArray[2]) : Promise.resolve(null),
            parallelArray[3] ? scraperFn(parallelArray[3]) : Promise.resolve(null),
            parallelArray[4] ? scraperFn(parallelArray[4]) : Promise.resolve(null)
        ]);
    }).then(result => {
        let tempCollection = _.flatten(result);
        tempCollection = _.reject(tempCollection, (item) => {
            return item === null;
        });
        
        if(tempCollection.length > 0){
            return createBatches(tempCollection);
        }else{
            return null;
        }
    }).then( batches => {
        if(batches){
            return executeBatches(batches);
        }
        else{
            return null;
        }
    })
    .catch(err => {
        console.error(err);
        return Promise.reject(err);
    })
}

module.exports = router;
