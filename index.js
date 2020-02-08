const cheerio = require('cheerio');
const https = require('https');
const fs = require('fs');
const dawContentsPage = 'https://www.drugsandwires.fail/contents/';

let contentsRaw;
let chaptersUrl = [];
let uniqueLastPagesArray = [];
let uniqueChaptersArray = [];
let uniqueImagesUrlArray = [];
let urlForDownload = [];

let getHtmlCode = function(url) {
  contentsRaw = null;

  return new Promise(function(resolve, reject) {
    https.get(url, function(res) {
      res.setEncoding('utf8');
      res.on('data', function(chunk) {
        contentsRaw += chunk;
      });

      res.on('end', function() {
        resolve();
      });
    }).on('error', function(e) {
      console.log('Error:' + e.message);
      reject();
    });
  });
};

let getChaptersUrl = function() {
  let chaptersLinks = cheerio('a', contentsRaw);
  for (i = 0; i < chaptersLinks.length; i++) {
    if (!chaptersLinks[i].attribs.href.includes('storyline') || chaptersLinks[i].attribs.href.includes('extras') || chaptersLinks[i].attribs.href.includes('wirepedia')) {
      continue;
    }

    if (chaptersLinks[i].attribs.href.includes('http:')) {
      chaptersUrl.push(chaptersLinks[i].attribs.href.replace('http:', 'https:'))
      continue;
    }

    chaptersUrl.push(chaptersLinks[i].attribs.href);
  }

  getChaptersUrls();
};

let getChaptersUrls = function() {
  let lastPagesArray = [];

  for (i = 0; i < chaptersUrl.length; i++) {
    getHtmlCode(chaptersUrl[i])
      .then(() => {
        let pageNumbers = cheerio('a.next.page-numbers', contentsRaw).prev();

        for (i = 0; i < pageNumbers.length; i++) {
          lastPagesArray.push(pageNumbers[i].attribs.href);
        }

        uniqueLastPagesArray = [... new Set(lastPagesArray)];
      })
      .finally(() => {
        if (i === chaptersUrl.length) {
          makeChapterUrls()
            .then(() => {
              sortChaptersArray();
              getImagesUrls();
              downloadImages();
          })
        }
      })

    if (i === chaptersUrl.length) {
      return;
    }
  }
};

let makeChapterUrls = function() {
  return new Promise((resolve) => {
    uniqueLastPagesArray.forEach((item) => {
      let lastChapter = item.slice(-3).replace(/\D+/g, '');
      let baseChapterUrl = item.substring(0, item.length - 3);

      for (i = lastChapter; i > 0; i--) {
        uniqueChaptersArray.push(baseChapterUrl + '/' + i + '/')
      }
    });

    resolve();
  })
};

let sortChaptersArray = function() {
  uniqueChaptersArray.reverse();
};

let getImagesUrls = function() {
  let iterator = 0;

  uniqueChaptersArray.forEach((item, index) => {
    getHtmlCode(item)
      .then(() => {
        iterator++;
        let imageUrl = cheerio('img.attachment-full', contentsRaw)

        for (i = 0; i < imageUrl.length; i++) {
          uniqueImagesUrlArray.push(imageUrl[i].attribs.src);
        }

        if (iterator === index) {
          urlForDownload = [... new Set(uniqueImagesUrlArray)]
          urlForDownload.array.forEach(item => {

          });
        }
      })
  })
};

let downloadImages = function() {
  console.log(urlForDownload);
};

getHtmlCode(dawContentsPage)
  .then(() => {
    getChaptersUrl();
  })
