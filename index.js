const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");

const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const session = require("express-session");

const bcrypt = require("bcrypt");
const saltRounds = 10;

const app = express();

app.use(express.json());
app.use(
  cors({
    origin: ["http://localhost:3000"],
    methods: ["GET", "POST"],
    credentials: true,
  })
);
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

const db = mysql.createConnection({
  user: "root",
  host: "localhost",
  password: "7116226",
  database: "jdar",
});

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
    "SELECT DISTINCT name FROM user INNER JOIN matchplayer ON user.userId = matchplayer.playerId ORDER BY name ASC",
    (err, result1) => {
      if (err) {
        console.log("err", err);
      } else {
        console.log("result1", result1);
        for (let i = 0; i < result1.length; i++) {
          db.query(
            "SELECT userId FROM user WHERE name = ?",
            result1[i].name,
            (err, result2) => {
              if (err) {
                console.log("err", err);
              } else {
                console.log("result2", result2);
                db.query(
                  "SELECT winCount FROM matchplayer WHERE playerId = ?",
                  result2[0].userId,
                  (err, result3) => {
                    if (err) {
                      console.log("err", err);
                    } else {
                      console.log("result3", result3);
                      const map = result3.map((obj) => {
                        return obj.winCount;
                      });
                      const reducer = (acc, cur) => {
                        console.log("acc", acc);
                        console.log("cur", cur);
                        return acc + cur;
                      };
                      const wins = map.reduce(reducer);
                      const partPoint = result3.length * 10;
                      const winPoint = wins * 10;
                      playerArr.push({
                        name: result1[i].name,
                        partPoint: partPoint,
                        winPoint: winPoint,
                        total: partPoint + winPoint,
                      });

                      // res.send({
                      //   result: {
                      //     name: req.query.name,
                      //     partPoint: partPoint,
                      //     winPoint: winPoint,
                      //     total: partPoint + winPoint,
                      //   },
                      // });

                      // res.write(
                      //   JSON.stringify({
                      //     name: player.name,
                      //     partPoint: partPoint,
                      //     winPoint: winPoint,
                      //     total: partPoint + winPoint,
                      //   })
                      // );
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
