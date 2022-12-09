const AWS = require("aws-sdk");
const fs = require('fs');
const ExcelJS = require('exceljs');
const path = require("path");

const PHOTO_EXTS = ['jpg', 'jpeg', 'png'];
if(process.argv.length === 3 && process.argv[2] === '--help') {
  console.log("Использование: wb-upload-photos [папка с фотками] [имя экселя на выходе] \n"
      + "Все параметры опциональные. Можно вызвать в текущей папке с фотками и получить 'Upload.xlsx' как реузльтат \n"
      + "в той же папке.");
  return;
}
const PHOTOS_FOLDER = (process.argv.length > 2) ? process.argv[2] : '';
const OUTPUT_FILE_NAME = (process.argv.length > 3) ? process.argv[3]
    : 'Upload.xlsx';

AWS.config.loadFromPath('config.json');

AWS.config.getCredentials(function (err) {
  if (err) {
    console.log(err.stack);
  } else {
    console.log('Connected to AWS, all good!!!');
    // console.log("Access key:", AWS.config.credentials.accessKeyId);
    // console.log("Region: ", AWS.config.region);
  }
});

const bucketName = 'wildberries-test';

var s3 = new AWS.S3({apiVersion: '2006-03-01'});

let photosDir = path.join(process.cwd(), PHOTOS_FOLDER);

let photos = fs.readdirSync(photosDir)
.filter(file => PHOTO_EXTS.some(ext => file.endsWith(ext)))
.sort()
.reduce((res, photo) => {
  const key = photo.split("_").slice(0, -1).join("_");
  if (key in res) {
    res[key].push(photo);
  } else {
    res[key] = [photo];
  }

  return res;
}, {});

const workbook = new ExcelJS.Workbook();
const sheet = workbook.addWorksheet('My Sheet');
sheet.addRow(['Артикул', 'Mediafiles']);

Promise.all(Object.entries(photos).map(([article, articlePhotos]) =>
    Promise.all(articlePhotos.map(articlePhoto =>
        s3.upload({
          Bucket: bucketName, Key: articlePhoto, Body: fs.readFileSync(
              PHOTOS_FOLDER + "/" + articlePhoto)
        }).promise()
        .then(res => {
          return res.Location;
        })
    ))
    .then(locations => {
      console.log("Артикул: %s, загружено %s файлов.", article,
          locations.length);
      return [article, locations.join(";")];
    }))
)
.then(rows => {
  rows.forEach(row => {
    sheet.addRow(row);
  });
  workbook.xlsx.writeFile(OUTPUT_FILE_NAME);
})
.catch(err => console.log(err));

