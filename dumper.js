const mysql = require("mysql");
const dotenv = require("dotenv");
const path = require("path");
const exec = require("child_process").exec;

dotenv.config();

async function asyncExec(command) {
  return new Promise((res, rej) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        rej(error);
      }
      res(stdout);
    });
  });
}

function getTodayString() {
  let today = new Date();
  const dd = String(today.getDate()).padStart(2, "0");
  const mm = String(today.getMonth() + 1).padStart(2, "0"); //January is 0!
  const yyyy = today.getFullYear();
  today = yyyy + "_" + mm + "_" + dd;
  return today;
}

async function dumpMysql(database) {
  if (!database) {
    throw new Error("Informe o nome do banco de dados para gerar o dump.");
  }
  const today = getTodayString();
  const fileName = `${database}_${today}.sql.gz`;
  const pathToFile = path.resolve(__dirname, "backups", `${fileName}`);

  var exec = require("child_process").exec;
  await asyncExec(
    `mysqldump -u ${process.env.DB_USER} --port=${process.env.DB_PORT} -p${process.env.DB_PASSWORD} ${database} | gzip > "${pathToFile}"`
  );
  // await mysqldump({
  //   connection: {
  //     host: process.env.DB_HOST,
  //     port: process.env.DB_PORT,
  //     user: process.env.DB_USER,
  //     password: process.env.DB_PASSWORD,
  //     database: database,
  //   },
  //   dumpToFile: pathToFile,
  //   compressFile: true,
  //   dump: {
  //     schema: { format: false },
  //   },
  // });

  return [fileName, pathToFile];
}

async function listAllDatabases() {
  const blacklist = [
    "information_schema",
    "mysql",
    "performance_schema",
    "sys",
    "teste",
    "updatedb",
  ];

  var con = mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    // database: "mydb",
  });

  return new Promise((resolve, reject) => {
    try {
      con.connect(function (err) {
        if (err) {
          throw err;
        }
        con.query("show databases", function (err, results, fields) {
          if (err) {
            throw err;
          }

          if (results.length) {
            const retorno = [];
            for (let i = 0; i < results.length; i++) {
              const result = results[i];
              if (!result) {
                continue;
              }

              const nomeDB = result.Database;
              if (nomeDB && !blacklist.includes(nomeDB)) {
                retorno.push(nomeDB);
              }
            }
            con.end();
            resolve(retorno);
          } else {
            resolve([]);
          }
        });
      });
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { dumpMysql, listAllDatabases };
