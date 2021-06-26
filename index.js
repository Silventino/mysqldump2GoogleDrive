const fs = require("fs");
const readline = require("readline");
const { google } = require("googleapis");
const dumper = require("./dumper");
const dotenv = require("dotenv");
dotenv.config();

// If modifying these scopes, delete token.json.
const SCOPES = ["https://www.googleapis.com/auth/drive.file"];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = "token.json";

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
async function authorize(credentials) {
  const { client_secret, client_id, redirect_uris } = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  // Check if we have previously stored a token.
  try {
    const token = fs.readFileSync(TOKEN_PATH);
    oAuth2Client.setCredentials(JSON.parse(token));
  } catch (err) {
    return getAccessToken(oAuth2Client);
  }
  return oAuth2Client;
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
async function getAccessToken(oAuth2Client) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
  });
  console.log("Authorize this app by visiting this url:", authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve, reject) => {
    rl.question("Enter the code from that page here: ", (code) => {
      rl.close();
      oAuth2Client.getToken(code, (err, token) => {
        if (err) {
          reject(err);
        }
        oAuth2Client.setCredentials(token);
        // Store the token to disk for later program executions
        fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
          if (err) {
            reject(err);
          }
          resolve(oAuth2Client);
        });
        // callback(oAuth2Client);
      });
    });
  });
}

async function listFiles(auth) {
  const drive = google.drive({ version: "v3", auth });
  const res = await drive.files.list({
    // pageSize: 10,
    fields: "nextPageToken, files(id, name, mimeType)",
  });
  const files = res.data.files;
  if (files.length) {
    console.log("Files:");
    files.map((file) => {
      // console.log(`${file.name} (${file.id})`);
      console.log(file);
    });
  } else {
    console.log("No files found.");
  }
}

async function getFolder(auth, name) {
  const drive = google.drive({ version: "v3", auth });
  const res = await drive.files.list({
    // pageSize: 10,
    fields: "nextPageToken, files(id, name, mimeType)",
  });
  const files = res.data.files;
  if (files.length) {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (
        file.name == name &&
        file.mimeType == "application/vnd.google-apps.folder"
      ) {
        return file.id;
      }
    }
  }
  return "";
}

async function createFolder(auth, name) {
  const drive = google.drive({ version: "v3", auth });
  var fileMetadata = {
    name: name,
    mimeType: "application/vnd.google-apps.folder",
  };
  const file = await drive.files.create({
    resource: fileMetadata,
    fields: "id",
  });
  return file.id;
}

async function getOrCreateFolder(auth, name) {
  let fileId = "";
  fileId = await getFolder(auth, name);
  if (!fileId) {
    console.log("Tive que criar nova pasta.");
    fileId = await createFolder(auth, name);
  }
  console.log("ID da pasta", fileId);
  return fileId;
}

async function uploadFile(auth, fileName, pathToFile, folderId) {
  const drive = google.drive({ version: "v3", auth });
  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      mimeType: "application/zip",
      parents: folderId ? [folderId] : undefined,
    },
    media: {
      mimeType: "application/zip",
      body: fs.createReadStream(pathToFile),
    },
  });
  console.log(res.data);
}

async function main() {
  try {
    // Load client secrets from a local file.
    const credentials = JSON.parse(fs.readFileSync("credentials.json"));
    const auth = await authorize(credentials);

    const folderId = await getOrCreateFolder(auth, "dumper_backups");
    const dbs = await dumper.listAllDatabases();
    console.log(dbs);
    for (let i = 0; i < dbs.length; i++) {
      try {
        const db = dbs[i];
        const [fileName, pathToFile] = await dumper.dumpMysql(db);
        await uploadFile(auth, fileName, pathToFile, folderId);
      } catch (err) {
        // TODO deu erro em algum aqui... tem que me enviar um email avisando
        console.log(err);
      }
    }
    // await listFiles(auth);
  } catch (err) {
    console.log(err);
  }
}
main();
