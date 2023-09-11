'use strict';

const express = require('express');
const app = express();
const uuid = require('uuid');
const fs = require('fs');
const { MongoClient, ObjectId } = require('mongodb');
const { pid } = require('process');

const PATH = './config/mongo.json';
let mongoDb;

function readConfig(path) {
    try {
        if (fs.existsSync(path)) {
            let data = fs.readFileSync(path);
            let obj = JSON.parse(data);
            return obj;
        } else {
            return {
                "host": "localhost",
                "port": "27017",
                "db": "ee547_hw",
                "opts": {
                    "useUnifiedTopology": true
                }
            };
        }
    } catch (err) {
        process.exit(2);
    }
}

try {
    let config = readConfig(PATH);

    const uri = `mongodb://${config["host"]}:${config["port"]}?useUnifiedTopology=${config["opts"]["useUnifiedTopology"]}`;
    const MONGO_DB = config["db"];
    MongoClient.connect(uri, (err, mongoConnect) => {
        if (err) {
            process.exit(5);
        }
        mongoDb = mongoConnect.db(MONGO_DB);
        if (!mongoDb.listCollections()) {
            mongoDb.createCollection('player', function(err, res) {
                if (err) throw err;
            });
        }
        app.listen(3000);
        console.log(`Server started, port ${3000}`);
    });
} catch (err) {
    console.error(err);
}

function preResponse(req, res, next) {
    req.my_data = {
        start_at: new Date(),
        request_id: uuid.v4()
    };
    next();
}

function readDB(query) {
    return new Promise(function (resolve, reject) {
        mongoDb.collection('player').find(query).toArray(function(err, result) {
            if (err) {
                reject(err);
            }
            
            const data = result.map(({ _id, fname, lname, handed, is_active, balance_usd }) => {
                return {
                    _id,
                    fname,
                    lname,
                    handed,
                    is_active,
                    balance_usd
                };
            });
            resolve(data);
        });
    });
}

function insertIntoDB(data) {
    return new Promise(function (resolve, reject) {
        mongoDb.collection('player').insertOne(data, function(err, result) {
            if (err) {
                reject(err);
            }

            let objectId = result.insertedId.toString();
            resolve(objectId);
        });
    });
}

function formatName(fname, lname='') {
    if (lname) {
        return `${fname} ${lname}`;
    } else {
        return fname;
    }
}

function formatHanded(handed) {
    if (handed.localeCompare('A', undefined, {sensitivity: 'accent'}) === 0) {
        return 'ambi';
    } else if (handed.localeCompare('L', undefined, {sensitivity: 'accent'}) === 0) {
        return 'left';
    } else if (handed.localeCompare('R', undefined, {sensitivity: 'accent'}) === 0) {
        return 'right';
    } else {
        return handed;
    }
}

function formatCurrency(val) {
    return `${parseFloat(val, 10).toFixed(2)}`;
}

function formatPlayer(obj) {
    if (isNaN(formatCurrency(obj.balance_usd))) {
        return {
            pid: obj._id,
            name: formatName(obj.fname, obj.lname),
            handed: formatHanded(obj.handed),
            is_active: obj.is_active
        };

    } else {
        return {
            pid: obj._id,
            name: formatName(obj.fname, obj.lname),
            handed: formatHanded(obj.handed),
            is_active: obj.is_active,
            balance_usd: formatCurrency(obj.balance_usd)
        };
    }
}

function checkValidBool(strBool) {
    if (strBool.localeCompare('true', undefined, {sensitivity: 'accent'}) === 0 ||
        strBool.localeCompare('t', undefined, {sensitivity: 'accent'}) === 0 ||
        strBool.localeCompare('false', undefined, {sensitivity: 'accent'}) === 0 ||
        strBool.localeCompare('f', undefined, {sensitivity: 'accent'}) === 0) {
        return true;
    } else if (!isNaN(Number(strBool)) && Number.isInteger(parseFloat(strBool, 10)) && strBool.length == 1) {
        if (Number(strBool) == 1 || Number(strBool) == 0) {
            return true;
        }
    } else {
        return false;
    }
}

function convertBool(strBool) {
    if (strBool.localeCompare('true', undefined, {sensitivity: 'accent'}) === 0 ||
        strBool.localeCompare('t', undefined, {sensitivity: 'accent'}) === 0) {
        return true;
    } else if (strBool.localeCompare('false', undefined, {sensitivity: 'accent'}) === 0 ||
        strBool.localeCompare('f', undefined, {sensitivity: 'accent'}) === 0) {
        return false;
    } else if (!isNaN(Number(strBool)) && Number.isInteger(parseFloat(strBool, 10)) && strBool.length == 1) {
        if (Number(strBool) == 1 ) {
            return true;
        } else if(Number(strBool) == 0) {
            return false;
        }
    } else {
        return undefined;
    }
}

function postResponse(req, res, next) {
    console.log(`Request complete -- path:${req.path}, status:${res.statusCode}, id:${req.my_data.request_id}`);
    next();
}

app.use(preResponse);

app.get('/ping',
    (req, res, next) => {
        res.status(204);
        res.end();
        next();
    }
);

app.get('/player', async (req, res, next) => {
    try {
        let players = await readDB({})
            .then(data => {
                return data;
            })
            .catch(err => {
                console.error(err);
            });

        let sortedActivePlayers = [];
        for (let i = 0; i < players.length; i++) {
            if (players[i].is_active) {
                sortedActivePlayers.push(players[i]);
            }
        }

        sortedActivePlayers.sort((a, b) => {
            if (a.fname < b.fname) {
                return -1;
            } else if (a.fname > b.fname) {
                return 1;
            } else {
                if (a.lname < b.lname) {
                    return -1
                } else if (a.lname > b.lname) {
                    return 1;
                }

                return 0;
            }
        });

        let formatSortedActivePlayers = [];
        for (let i = 0; i < sortedActivePlayers.length; i++) {
            formatSortedActivePlayers.push(formatPlayer(sortedActivePlayers[i]));
        }

        res.status(200).json(formatSortedActivePlayers);
        res.end();
    } catch (err) {
        return next(err);
    }

    next();
});


app.get('/player/:pid', async (req, res, next) => {
    try {
        let query = {"_id": {$in: [ObjectId(req.params.pid)]}};
        let players = await readDB(query)
            .then(data => {
                return data;
            })
            .catch(err => {
                console.error(err);
            });

        if (players.length == 0) {
            res.status(404);
            res.end();
        } else {
            let desiredPlayer = players[0];
            let formatDesiredPlayer = formatPlayer(desiredPlayer);

            res.status(200).json(formatDesiredPlayer);
            res.end();
        }
    } catch (err) {
        return next(err);
    }

    next();
});

app.delete('/player/:pid', async (req, res, next) => {
    try {
        let players = await readDB({})
            .then(data => {
                return data;
            })
            .catch(err => {
                console.error(err);
            });

        let prev_len = players.length;
        let obj;
        for (let i = 0; i < players.length; i++) {
            if (players[i]._id.toString() == req.params.pid) {
                obj = players[i]._id;
                players.splice(i, 1);
            }
        }

        let new_len = players.length;

        if (prev_len == new_len) {
            res.status(404);
            res.end();
        } else {
            mongoDb.collection('player').deleteOne({"_id": obj}, function(err, result) {
                if (err) return err;
            });

            res.redirect(303, '/player');
            res.end();
        }
    } catch (err) {
        return next(err);
    }

    next();
});

app.post('/player', async (req, res, next) => {
    try {
        let qs = req.query;
        let newFname = "";
        let newLname = "";
        let newHanded = "";
        let newInitBalance = "";
        let invalidFields = [];

        if ("fname" in qs) {
            if (!/[^a-zA-Z]/.test(qs.fname) && qs.fname.length > 0) {
                newFname = qs.fname;
            } else {
                invalidFields.push("fname");
            }
        }

        if ("lname" in qs) {
            if (!/[^a-zA-Z]/.test(qs.lname) && qs.lname.length > 0) {
                newLname = qs.lname;
            } else {
                invalidFields.push("lname");
            }
        }

        if ("handed" in qs) {
            if (qs.handed.localeCompare('left', undefined, {sensitivity: 'accent'}) === 0 || 
                qs.handed.localeCompare('right', undefined, {sensitivity: 'accent'}) === 0 || 
                qs.handed.localeCompare('ambi', undefined, {sensitivity: 'accent'}) === 0) {
                newHanded = qs.handed;
            } else {
                invalidFields.push("handed");
            }
        }

        if ("initial_balance_usd" in qs) {
            if (isNaN(parseFloat(qs.initial_balance_usd))) {
                invalidFields.push("initial_balance_usd");
            } else {
                let splitCurrency = qs.initial_balance_usd.split('.');
                if (splitCurrency.length == 2) {
                    if (splitCurrency[1].length >= 3) {
                        invalidFields.push("initial_balance_usd");
                    } else if (splitCurrency[1].length == 1) {
                        qs.initial_balance_usd += '0';
                        newInitBalance = qs.initial_balance_usd;
                    } else if (splitCurrency[1].length == 2) {
                        newInitBalance = qs.initial_balance_usd;
                    } else {
                        qs.initial_balance_usd += '00';
                        newInitBalance = qs.initial_balance_usd;
                    }
                } else if (splitCurrency.length == 1) {
                    qs.initial_balance_usd += '.00';
                    newInitBalance = qs.initial_balance_usd;
                } else {
                    invalidFields.push("initial_balance_usd");
                }
            }
        }

        let isInvalid = false;
        let invalidString = "";
        if (invalidFields.length > 0) {
            isInvalid = true;
            invalidString += "invalid fields:";
            for (let i = 0; i < invalidFields.length; i++) {
                if (i == invalidFields.length-1) {
                    invalidString += " " + invalidFields[i];
                } else {
                    invalidString += " " + invalidFields[i] + ",";
                }
            }

        }

        let schema = ["fname", "lname", "handed", "initial_balance_usd"]
        let validSchema = true;
        for (const q in qs) {
            if (!schema.includes(q)) {
                validSchema = false;
            }
        }

        if (validSchema) {
            if (isInvalid) {
                res.status(422);
                res.end(`<html><body><h1> ${invalidString} </h1></body></html>`);
            } else {
                let temp_obj = {
                    fname: newFname,
                    lname: newLname,
                    handed: newHanded,
                    is_active: true,
                    balance_usd: newInitBalance,
                    created_at: new Date()
                };

                let objectId = await insertIntoDB(temp_obj)
                    .then(data => {
                        return data;
                    })
                    .catch(err => {
                        console.error(err);
                    });

                res.redirect(303, `/player/${objectId}`);
                res.end();    
            }
        } else {
            res.status(422);
            res.end();
        }
    } catch (err) {
        return next(err);
    }

    next();
});

app.post('/player/:pid', async (req, res, next) => {
    try {
        let qs = req.query;
        let players = await readDB({})
            .then(data => {
                return data;
            })
            .catch(err => {
                console.error(err);
            });

        let obj;
        let desiredPlayer = undefined;
        for (let i = 0; i < players.length; i++) {
            if (players[i]._id.toString() == req.params.pid) {
                desiredPlayer = players[i];
                obj = players[i]._id;
            }
        }

        let newActive = undefined;
        let newFname = undefined;
        let newLname = undefined;
        let newHanded = undefined;
        let newInitBalance = undefined;
        let invalidFields = [];

        if ("active" in qs) {
            if (checkValidBool(qs.active)) {
                newActive = convertBool(qs.active);
            } else {
                invalidFields.push("active");
            }
        }

        if ("fname" in qs) {
            if (!/[^a-zA-Z]/.test(qs.fname)) {
                newFname = qs.fname;
            } else {
                invalidFields.push("fname");
            }
        }

        if ("lname" in qs) {
            if (!/[^a-zA-Z]/.test(qs.lname)) {
                newLname = qs.lname;
            } else {
                invalidFields.push("lname");
            }
        }

        if ("handed" in qs) {
            if (qs.handed.localeCompare('left', undefined, {sensitivity: 'accent'}) === 0 || 
                qs.handed.localeCompare('right', undefined, {sensitivity: 'accent'}) === 0 || 
                qs.handed.localeCompare('ambi', undefined, {sensitivity: 'accent'}) === 0) {
                newHanded = qs.handed;
            } else {
                invalidFields.push("handed");
            }
        }

        if ("initial_balance_usd" in qs) {
            if (isNaN(parseFloat(qs.initial_balance_usd))) {
                invalidFields.push("initial_balance_usd");
            } else {
                let splitCurrency = qs.initial_balance_usd.split('.');
                if (splitCurrency.length == 2) {
                    if (splitCurrency[1].length >= 3) {
                        invalidFields.push("initial_balance_usd");
                    } else if (splitCurrency[1].length == 1) {
                        qs.initial_balance_usd += '0';
                        newInitBalance = qs.initial_balance_usd;
                    } else if (splitCurrency[1].length == 2) {
                        newInitBalance = qs.initial_balance_usd;
                    } else {
                        qs.initial_balance_usd += '00';
                        newInitBalance = qs.initial_balance_usd;
                    }
                } else if (splitCurrency.length == 1) {
                    qs.initial_balance_usd += '.00';
                    newInitBalance = qs.initial_balance_usd;
                } else {
                    invalidFields.push("initial_balance_usd");
                }
            }
        }
        let isInvalid = false;
        if (invalidFields.length > 0) {
            isInvalid = true;
        }

        let schema = ["active", "fname", "lname", "handed", "initial_balance_usd"]
        let validSchema = true;
        for (const q in qs) {
            if (!schema.includes(q)) {
                validSchema = false;
            }
        }

        if (validSchema) {
            if (isInvalid) {
                res.status(422);
                res.end();
            } else if (typeof desiredPlayer == "undefined") {
                res.status(404);
                res.end();
            } else {
                if (typeof newActive != 'undefined') {
                    desiredPlayer.is_active = newActive;
                }

                if (typeof newFname != 'undefined') {
                    desiredPlayer.fname = newFname;
                }

                if (typeof newLname != 'undefined') {
                    desiredPlayer.lname = newLname;
                }

                if (typeof newHanded != 'undefined') {
                    desiredPlayer.handed = newHanded;
                }

                if (typeof newInitBalance != 'undefined') {
                    desiredPlayer.balance_usd = newInitBalance;
                }
                
                let newValues = { $set: desiredPlayer};
                const result = mongoDb.collection('player').updateOne({"_id": obj}, newValues);

                res.redirect(303, `/player/${req.params.pid}`);
                res.end();    
            }
        } else {
            res.status(422);
            res.end();
        }
    } catch (err) {
        return next(err);
    }

    next();
});

app.post('/deposit/player/:pid', async (req, res, next) => {
    try {
        let qs = req.query;
        let players = await readDB()
            .then(data => {
                return data;
            })
            .catch(err => {
                console.error(err);
            });

        let obj;
        let desiredPlayer = undefined;
        for (let i = 0; i < players.length; i++) {
            if (players[i]._id.toString() == req.params.pid) {
                obj = players[i]._id;
                desiredPlayer = players[i];
            }
        }

        let exists = true;
        if (typeof desiredPlayer == "undefined") {
            exists = false;
        }

        let isInvalid = false;
        
        if ("amount_usd" in qs) {
            if (isNaN(parseFloat(qs.amount_usd)) || typeof qs.amount_usd == "undefined" || parseFloat(qs.amount_usd) < 0) {
                isInvalid = true;
            } else {
                let splitCurrency = qs.amount_usd.split('.');
                if (splitCurrency.length == 2) {
                    if (splitCurrency[1].length >= 3) {
                        isInvalid = true;
                    } else if (splitCurrency[1].length == 1) {
                        qs.amount_usd += '0';
                    } else if (splitCurrency[1].length == 0) {
                        qs.amount_usd += '00';
                    }
                } else if (splitCurrency.length == 1) {
                    qs.amount_usd += '.00';
                } else {
                    isInvalid = true;
                }
            }
        } else {
            isInvalid = true;
        }

        if (!exists) {
            res.status(404);
            res.end();
        } else if (isInvalid) {
            res.status(400);
            res.end();
        } else {
            console.log('runs');
            let currBalanceString = desiredPlayer.balance_usd;
            if (isNaN(parseFloat(currBalanceString))) {
                currBalanceString = "0.00";
            }

            let currBalance = parseFloat(currBalanceString, 10);

            let new_balance = (currBalance + parseFloat(qs.amount_usd, 10)).toString();

            let splitCurrency = new_balance.split('.');
            if (splitCurrency.length == 2) {
                if (splitCurrency[1].length == 1) {
                    new_balance += '0';
                } else if (splitCurrency[1].length == 0) {
                    new_balance += '00';
                }
            } else if (splitCurrency.length == 1) {
                new_balance += '.00';
            }

            desiredPlayer.balance_usd = new_balance;
            let newValues = { $set: desiredPlayer};


            const result = await mongoDb.collection('player').updateOne({"_id": obj}, newValues);
            res.status(200).json({"old_balance_usd": currBalanceString, "new_balance_usd": desiredPlayer.balance_usd});
            res.end();
        }
    } catch (err) {
        return next(err);
    }
    next();
});

app.use(postResponse);