const cheerio = require('cheerio');
const https = require('https');
const request = require('request')
const async = require('async')
const ProgressBar = require('progress')
const fs = require('fs');
const dawContentsPage = 'https://www.drugsandwires.fail/contents/';

let contentsRaw;
let chaptersUrl = [];
let lastPagesArray = [];
let uniqueLastPagesArray = [];
let uniqueChaptersArray = [];
let downloadIterator = 0;

let getHtmlCode = function(url, persistent = false) {
  if (!persistent) {
    contentsRaw = null;
  }

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

let getChapterUrl = function() {
  getHtmlCode(dawContentsPage)
    .then(() => {
      let chaptersLinks = cheerio('a', contentsRaw);
      for (let i = 0, length = chaptersLinks.length; i < length; i++) {
        if (
          !chaptersLinks[i].attribs.href.includes('storyline') ||
          chaptersLinks[i].attribs.href.includes('extras') ||
          chaptersLinks[i].attribs.href.includes('wirepedia')
        ) {
          continue;
        }

        if (chaptersLinks[i].attribs.href.includes('http:')) {
          chaptersUrl.push(chaptersLinks[i].attribs.href.replace('http:', 'https:'))
          continue;
        }

        chaptersUrl.push(chaptersLinks[i].attribs.href);
        console.log('Parsing contents page');
      }
    })
    .finally(() => {
      console.log('Parsing complete');
      getChaptersLinks();
    })
};

let getChaptersLinks = function() {
  let pageNumbers;

  for (let i = 0, length = chaptersUrl.length; i < length; i++) {
    console.log('Generating URL');
    getHtmlCode(chaptersUrl[i])
      .then(() => {
        pageNumbers = cheerio('a.next.page-numbers', contentsRaw).prev();

        for (let i = 0, length = pageNumbers.length; i < length; i++) {
          lastPagesArray.push(pageNumbers[i].attribs.href);
        }
      })
      .finally(() => {
        if (i === length - 1) {
          setTimeout(function() {
            console.log('Generating URL complete');
            makeChapterUrls();
          }, 100)
        }
      })
  }
};

let makeChapterUrls = function() {
  uniqueLastPagesArray = [... new Set(lastPagesArray)];

  if (!uniqueLastPagesArray.length === 6) {
    console.log('Parsing has failed, try again!');
    return;
  }

  console.log('Number of parsed chapters: ', uniqueLastPagesArray.length);

  for (let i = 0, length = uniqueLastPagesArray.length; i < length; i++) {
    let item = uniqueLastPagesArray[i];
    let lastChapter = item.slice(-3).replace(/\D+/g, '');
    let baseChapterUrl = item.substring(0, item.length - 3);

    for (let item = lastChapter; item > 0; item--) {
      if (item == 1) {
        uniqueChaptersArray.push(baseChapterUrl.replace('/page/', '/'));
        continue;
      }

      uniqueChaptersArray.push(baseChapterUrl + '/' + item + '/');
    }

    if (i === length - 1) {
      downloadImages();
    }
  }
};

let downloadImages = function() {
  uniqueChaptersArray.reverse();
  console.log(['List of links to be downloaded: ', uniqueChaptersArray, 'Totaling: ' + uniqueChaptersArray.length]);
  let downloadArray = [];

  for (let i = 0, length = uniqueChaptersArray.length; i < length; i++) {
    getHtmlCode(uniqueChaptersArray[i], true)
      .then(() => {
        let imageUrl = cheerio('.attachment-full', contentsRaw);

        for (let itx = 0, len = imageUrl.length; itx < len; itx++) {
          downloadArray.push(imageUrl[itx].attribs.src)
        }

        if (i === length - 1) {
          let sortedLinks = [... new Set(downloadArray.sort())];
          console.log('Started downloading! -> Total number of items: ' + sortedLinks.length);
          console.log('Waiting for actual pages list');
          setTimeout(function() {
            console.log('Actual pages list complete!');
            dl.downloadFiles(sortedLinks);
          }, 5000)
        }
      })
  }
};

class Downloader {
  constructor() {
    this.q = async.queue(this.singleFile, 1);

    this.q.drain(function() {
      console.log('all items have been processed');
    });

    this.q.error(function(err, task) {
      console.error('task experienced an error', task);
    });
  }

  downloadFiles(links) {
    console.log(links.length);

    for (let link of links) {
      this.q.push(link);
    }
  }

  singleFile(link, cb) {
    downloadIterator++;
    let file = request(link);
    let bar;
    let path = file.uri.pathname.replace('/wp-content/uploads/', '');
    let name = path.replace(/\//g, '-');

    file.on('response', (res) => {
      const len = parseInt(res.headers['content-length'], 10);
      bar = new ProgressBar('  Downloading [:bar] :rate/bps :percent :etas', {
        complete: '=',
        incomplete: ' ',
        width: 20,
        total: len
      });
      file.on('data', (chunk) => {
        bar.tick(chunk.length);
      })
      file.on('end', () => {
        console.log('\n' + 'Downloaded index: ' + downloadIterator + '\n');
        cb();
      })
    })
    file.pipe(fs.createWriteStream('./images/' + name))
  }
}

const dl = new Downloader();

getChapterUrl();
