const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");

const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const session = require("express-session");

const bcrypt = require("bcrypt");
const saltRounds = 10;

const app = express();
let db;
require("dotenv").config();

app.use(express.json());
if (process.env.IS_HEROKU) {
  app.use(
    cors({
      origin: ["https://jdar-server.herokuapp.com/"],
      methods: ["GET", "POST"],
    })
  );
} else {
  app.use(
    cors({
      origin: ["http://localhost:3000"],
      methods: ["GET", "POST"],
    })
  );
}
// app.use(cors());
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(
  session({
    key: "userId",
    secret: "subscribe",
    resave: false,
    saveUninitialized: false,
    cookie: {
      expires: 60 * 60 * 24,
    },
  })
);

if (process.env.IS_HEROKU) {
  db = mysql.createConnection(process.env.JAWSDB_URL);
} else {
  db = mysql.createConnection({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DB,
  });
}

app.post("/register", (req, res) => {
  const username = req.body.username;
  const password = req.body.password;
  const name = req.body.name;
  const gender = req.body.gender;

  bcrypt.hash(password, saltRounds, (err, hash) => {
    if (err) {
      console.log(err);
    }

    db.query(
      "INSERT INTO user (username, password, name, gender) VALUES (?,?,?,?)",
      [username, hash, name, gender],
      (err, result) => {
        if (err) {
          res.send({ message: "이미 사용중인 아이디입니다." });
        } else {
          res.send({ result: result });
        }
      }
    );
  });
});

app.post("/matchregister", (req, res) => {
  const date = req.body.date;
  const ownerName = req.body.ownerName;
  const location = req.body.location;

  db.query(
    "SELECT userId FROM user WHERE name = ?;",
    ownerName,
    (err, result) => {
      if (err) {
        res.send({ message: err });
      } else {
        db.query(
          "INSERT INTO jdar.match (date, ownerId, location) VALUES (?,?,?)",
          [date, result[0].userId, location],
          (err, result) => {
            if (err) {
              res.send({ message: err });
            } else {
              res.send({ result: result });
            }
          }
        );
      }
    }
  );
});

app.post("/registerplayer", (req, res) => {
  const date = req.body.date;
  const ownerName = req.body.ownerName;
  const location = req.body.location;
  const participants = req.body.participants;
  let matchId;

  db.query(
    "SELECT userId FROM user WHERE name = ?;",
    ownerName,
    (err, result) => {
      if (err) {
        console.log("err", err);
      } else {
        db.query(
          "SELECT matchId FROM jdar.match WHERE (ownerId = ? AND date = ? AND location = ?);",
          [result[0].userId, date, location],
          (err, result) => {
            if (err) {
              console.log("err", err);
            } else {
              console.log("matchId", result);
              matchId = result[0].matchId;
              participants.forEach((participant) => {
                db.query(
                  "SELECT userId FROM user WHERE name = ?;",
                  participant.name,
                  (err, result) => {
                    if (err) {
                      console.log("err", err);
                    } else {
                      console.log("userId", result[0].userId);
                      db.query(
                        "INSERT INTO jdar.matchplayer (matchId, playerId, winCount) VALUES (?,?,?)",
                        [
                          matchId,
                          result[0].userId,
                          parseInt(participant.winCount),
                        ],
                        (err, result) => {
                          if (err) {
                            console.log("err", err);
                          } else {
                            console.log("succeed", result);
                          }
                        }
                      );
                    }
                  }
                );
              });
            }
          }
        );
      }
    }
  );
});

app.get("/getnames", (req, res) => {
  db.query("SELECT name FROM user ORDER BY name ASC;", (err, result) => {
    if (err) {
      res.send({ message: err });
    } else {
      res.send({ result: result });
    }
  });
});

app.get("/getplayerscore", (req, res) => {
  const playerArr = [];
  db.query(
    "SELECT userId, name FROM user ORDER BY name ASC",
    (err, result1) => {
      if (err) {
        console.log("err", err);
      } else {
        console.log("result1", result1);
        for (let i = 0; i < result1.length; i++) {
          db.query(
            "SELECT ownerId FROM jdar.match WHERE ownerId = ?",
            result1[i].userId,
            (err, result2) => {
              let ownerCount;
              if (err) {
                console.log("err", err);
              } else {
                ownerCount = result2.length;
                console.log("result2", result2);
                db.query(
                  "SELECT winCount FROM matchplayer WHERE playerId = ?",
                  result1[i].userId,
                  (err, result3) => {
                    if (err) {
                      console.log("err", err);
                    } else {
                      console.log("result3", result3);
                      const map = result3.map((obj) => {
                        return obj.winCount;
                      });
                      const reducer = (acc, cur) => {
                        return acc + cur;
                      };
                      const wins = map.reduce(reducer, 0);
                      const partPoint = result3.length * 10;
                      const winPoint = wins * 10;
                      const ownerPoint = ownerCount * 10;
                      const total = partPoint + winPoint + ownerPoint;
                      let lvl;
                      if (total >= 300) {
                        lvl = 3;
                      } else if (total >= 160) {
                        lvl = 2;
                      } else {
                        lvl = 1;
                      }

                      playerArr.push({
                        name: result1[i].name,
                        partPoint: partPoint,
                        winPoint: winPoint,
                        ownerPoint: ownerPoint,
                        total: total,
                        level: lvl,
                      });
                    }
                    console.log("arr", playerArr);
                    if (i === result1.length - 1) {
                      res.send(JSON.stringify(playerArr));
                    }
                  }
                );
              }
            }
          );
        }
      }
    }
  );
});

app.get("/login", (req, res) => {
  if (req.session.user) {
    res.send({ loggedIn: true, user: req.session.user });
  } else {
    res.send({ loggedIn: false });
  }
});

app.post("/login", (req, res) => {
  const username = req.body.username;
  const password = req.body.password;

  db.query(
    "SELECT * FROM user WHERE username = ?;",
    username,
    (err, result) => {
      if (err) {
        res.send({ err: err });
      }

      if (result.length > 0) {
        bcrypt.compare(password, result[0].password, (error, response) => {
          if (response) {
            req.session.user = result;
            console.log(req.session.user);
            res.send(result);
          } else {
            res.send({ message: "Wrong username/password combination!" });
          }
        });
      } else {
        res.send({ message: "User doesn't exist" });
      }
    }
  );
});

app.listen(3001, () => {
  console.log("running server");
});
