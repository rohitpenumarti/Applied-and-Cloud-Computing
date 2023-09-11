'use strict';

const express = require('express');
const app = express();
const uuid = require('uuid');
const fs = require('fs');
const { MongoClient, ObjectId, ConnectionClosedEvent } = require('mongodb');

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

function readCollection(query, cname) {
    return new Promise(function (resolve, reject) {
        mongoDb.collection(cname).find(query).toArray(function(err, result) {
            if (err) {
                reject(err);
            }
            let data;
            if (cname == "player") {
                data = result.map(({ _id, fname, lname, handed, is_active, balance_usd }) => {
                    return {
                        _id,
                        fname,
                        lname,
                        handed,
                        is_active,
                        balance_usd
                    };
                });
            } else {
                data = result.map(({ _id, created_at, entry_fee_usd, p1_id, p2_id, prize_usd, p1_points, p2_points, ended_at}) => {
                    return {
                        _id,
                        created_at,
                        entry_fee_usd,
                        p1_id,
                        p2_id,
                        prize_usd,
                        p1_points,
                        p2_points,
                        ended_at
                    };
                });
            }
            resolve(data);
        });
    });
}

function insertIntoCollection(data, cname) {
    return new Promise(function (resolve, reject) {
        mongoDb.collection(cname).insertOne(data, function(err, result) {
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
        obj.pid = obj._id;
        obj.name = formatName(obj.fname, obj.lname);
        obj.handed = formatHanded(obj.handed);
        obj.is_active = obj.is_active;
        if (!("num_join" in obj)) {
            obj.num_join = 0;
        }
        if (!("num_won" in obj)) {
            obj.num_won = 0;
        }
        if (!("num_dq" in obj)) {
            obj.num_dq = 0;
        }
        if (!("total_points" in obj)) {
            obj.total_points = 0;
        }
        if (!("total_prize_usd" in obj)) {
            obj.total_prize_usd = formatCurrency(0);
        }
        if (!("efficiency" in obj)) {
            if (obj.num_join > 0) {                
                obj.efficiency = obj.num_won/obj.num_join;
            } else {
                obj.efficiency = null;
            }
        }
        if (!("in_active_match" in obj)) {
            obj.in_active_match = null;
        }
        return obj;
    } else {
        obj.pid = obj._id;
        obj.name = formatName(obj.fname, obj.lname);
        obj.handed = formatHanded(obj.handed);
        obj.is_active = obj.is_active;
        obj.balance_usd = formatCurrency(obj.balance_usd);
        if (!("num_join" in obj)) {
            obj.num_join = 0;
        }
        if (!("num_won" in obj)) {
            obj.num_won = 0;
        }
        if (!("num_dq" in obj)) {
            obj.num_dq = 0;
        }
        if (!("total_points" in obj)) {
            obj.total_points = 0;
        }
        if (!("total_prize_usd" in obj)) {
            obj.total_prize_usd = formatCurrency(0);
        }
        if (!("efficiency" in obj)) {
            if (obj.num_join > 0) {                
                obj.efficiency = obj.num_won/obj.num_join;
            } else {
                obj.efficiency = null;
            }
        }
        if (!("in_active_match" in obj)) {
            obj.in_active_match = null;
        }
        return obj;
    }
}

function formatMatch(obj, p1_obj, p2_obj) {
    let p1_name = formatName(p1_obj.fname, p1_obj.lname);
    let p2_name = formatName(p2_obj.fname, p2_obj.lname);

    let is_active = true;
    let winner_pid = null;

    let p1_points = 0;
    if ("p1_points" in obj) {
        if (typeof obj.p1_points != "undefined") {
            p1_points = obj.p1_points;
        }
    }

    let p2_points = 0;
    if ("p2_points" in obj) {
        if (typeof obj.p2_points != "undefined") {
            p2_points = obj.p2_points;
        }
    }

    let is_dq = false;
    if ("is_dq" in obj) {
        is_dq = obj.is_dq;
    }

    let prize_usd = "";
    if ("prize_usd" in obj) {
        prize_usd = obj.prize_usd;
    }

    let ended_at = null;
    let age = 0;
    if ("ended_at" in obj) {
        if (typeof obj.ended_at != "undefined") {
            ended_at = obj.ended_at;
            if (ended_at == null) {
                is_active = false;
            } else {
                winner_pid = NaN;
                age = (ended_at.getTime()-obj.created_at.getTime())/1000
                if (obj.p1_points < obj.p2_points) {
                    winner_pid = obj.p2_id;
                } else {
                    winner_pid = obj.p1_id;
                }
            }
        }
    }

    return {
        mid: obj._id,
        entry_fee_usd: obj.entry_fee_usd,
        p1_id: obj.p1_id,
        p1_name: p1_name,
        p1_points: p1_points,
        p2_id: obj.p2_id,
        p2_name: p2_name,
        p2_points: p2_points,
        winner_pid: winner_pid,
        is_dq: is_dq,
        is_active: is_active,
        prize_usd: prize_usd,
        age: Math.floor(age),
        ended_at: ended_at
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
        let players = await readCollection({}, 'player')
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

app.get('/match', async (req, res, next) => {
    try {
        let matches = await readCollection({}, 'match')
            .then(data => {
                return data;
            })
            .catch(err => {
                console.error(err);
            });

        let sortedActiveMatches = [];
        let sortedInactiveMatches = [];
        for (let i = 0; i < matches.length; i++) {
            if (!(matches[i].ended_at instanceof Date)) {
                sortedActiveMatches.push(matches[i]);
            } else {
                sortedInactiveMatches.push(matches[i]);
            }
        }

        sortedActiveMatches.sort((a, b) => {
            if (a.prize_usd < b.prize_usd) {
                return 1;
            } else if (a.prize_usd > b.prize_usd) {
                return -1;
            } else {
                return 0;
            }
        });

        sortedInactiveMatches.sort((a, b) => {
            return -(new Date(a.ended_at) - new Date(b.ended_at));
        });

        let formatSortedActiveMatches = [];
        for (let i = 0; i < sortedActiveMatches.length; i++) {
            let query1 = {"_id": {$in: [ObjectId(sortedActiveMatches[i].p1_id)]}};
            let player1 = await readCollection(query1, 'player')
                .then(data => {
                    return data;
                })
                .catch(err => {
                    console.error(err);
                });

            let query2 = {"_id": {$in: [ObjectId(sortedActiveMatches[i].p2_id)]}};
            let player2 = await readCollection(query2, 'player')
                .then(data => {
                    return data;
                })
                .catch(err => {
                    console.error(err);
                });
            formatSortedActiveMatches.push(formatMatch(sortedActiveMatches[i], player1[0], player2[0]));
        }

        for (let i = 0; i < sortedInactiveMatches.slice(0, 4).length; i++) {
            let query1 = {"_id": {$in: [ObjectId(sortedInactiveMatches.slice(0, 4)[i].p1_id)]}};
            let player1 = await readCollection(query1, 'player')
                .then(data => {
                    return data;
                })
                .catch(err => {
                    console.error(err);
                });

            let query2 = {"_id": {$in: [ObjectId(sortedInactiveMatches.slice(0, 4)[i].p2_id)]}};
            let player2 = await readCollection(query2, 'player')
                .then(data => {
                    return data;
                })
                .catch(err => {
                    console.error(err);
                });
            formatSortedActiveMatches.push(formatMatch(sortedInactiveMatches.slice(0, 4)[i], player1[0], player2[0]));
        }

        res.status(200).json(formatSortedActiveMatches);
        res.end();
    } catch (err) {
        return next(err);
    }

    next();
});


app.get('/player/:pid', async (req, res, next) => {
    try {
        let query = {"_id": {$in: [ObjectId(req.params.pid)]}};
        let players = await readCollection(query, 'player')
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

app.get('/match/:mid', async (req, res, next) => {
    try {
        let matches = [];
        if (ObjectId.isValid(req.params.mid)) {
            let query = {"_id": {$in: [ObjectId(req.params.mid)]}};
            matches = await readCollection(query, 'match')
                .then(data => {
                    return data;
                })
                .catch(err => {
                    console.error(err);
                });
        }

        if (matches.length == 0) {
            res.status(404);
            res.end();
        } else {
            let desiredMatch = matches[0];
            let query1 = {"_id": {$in: [ObjectId(desiredMatch.p1_id)]}};
            let player1 = await readCollection(query1, 'player')
                .then(data => {
                    return data;
                })
                .catch(err => {
                    console.error(err);
                });

            let query2 = {"_id": {$in: [ObjectId(desiredMatch.p2_id)]}};
            let player2 = await readCollection(query2, 'player')
                .then(data => {
                    return data;
                })
                .catch(err => {
                    console.error(err);
                });
            
            let formatDesiredMatch = formatMatch(desiredMatch, player1[0], player2[0]);
            console.log(formatDesiredMatch);

            res.status(200).json(formatDesiredMatch);
            res.end();
        }
    } catch (err) {
        return next(err);
    }

    next();
});

app.delete('/player/:pid', async (req, res, next) => {
    try {
        let players = await readCollection({}, 'player')
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
                    created_at: new Date(),
                    num_join: 0,
                    num_won: 0,
                    num_dq: 0,
                    total_points: 0,
                    total_prize_usd: 0,
                    efficiency: undefined,
                    in_active_match: null
                };

                let objectId = await insertIntoCollection(temp_obj, 'player')
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

app.post('/match', async (req, res, next) => {
    try {
        let qs = req.query;
        let pid1 = undefined;
        let pid2 = undefined;
        let entry_fee = "";
        let prize_usd = "";
        let sufficient_balance = true;
        let already_active = false;
        let newBalance1 = undefined;
        let newBalance2 = undefined;

        if ("prize_usd" in qs) {
            let splitPrize = qs.prize_usd.split('.');
            if (splitPrize.length == 2) {
                let numDec = splitPrize[1].length;
                if (numDec <= 2) {
                    prize_usd = parseFloat(qs.prize_usd).toFixed(2).toString();
                }
            } else if (splitPrize.length == 1) {
                prize_usd = parseFloat(qs.prize_usd).toFixed(2).toString();
            }
        }

        if ("p1_id" in qs) {
            let query = {"_id": {$in: [ObjectId(qs.p1_id)]}};
            let check = await readCollection(query, 'player')
                .then(data => {
                    return data;
                })
                .catch(err => {
                    console.error(err);
                });

            if (check[0].length != 0) {
                pid1 = qs.p1_id;
                let matches = await readCollection({}, 'match')
                    .then(data => {
                        return data;
                    })
                    .catch(err => {
                        console.error(err);
                    });
                
                for (let m of matches) {
                    if ((m.p1_id == pid1 || m.p2_id == pid1) && m.ended_at == null) {
                        already_active = true;
                    }
                }
    
                if ("entry_fee_usd" in qs) {
                    let splitFee = qs.entry_fee_usd.split('.');
                    if (splitFee.length == 2) {
                        let numDec = splitFee[1].length;
                        if (numDec <= 2) {
                            entry_fee = parseFloat(qs.entry_fee_usd).toFixed(2).toString();
                            let p1balance = check[0].balance_usd;
                            if (parseFloat(p1balance, 10) < parseFloat(entry_fee, 10)) {
                                sufficient_balance = false;
                            } else {
                                let tmp = parseFloat(p1balance, 10) - parseFloat(entry_fee, 10);
                                newBalance1 = tmp.toFixed(2);
                            }
                        }
                    } else if (splitFee.length == 1) {
                        entry_fee = parseFloat(qs.entry_fee_usd).toFixed(2).toString();
                        let p1balance = check[0].balance_usd;
                        if (parseFloat(p1balance, 10) < parseFloat(entry_fee, 10)) {
                            sufficient_balance = false;
                        } else {
                            let tmp = parseFloat(p1balance, 10) - parseFloat(entry_fee, 10);
                            newBalance1 = tmp.toFixed(2);
                        }
                    }
                }
            }
        }

        if ("p2_id" in qs) {
            let query = {"_id": {$in: [ObjectId(qs.p2_id)]}};
            let check = await readCollection(query, 'player')
                .then(data => {
                    return data;
                })
                .catch(err => {
                    console.error(err);
                });
            
            if (check.length != 0) {
                pid2 = qs.p2_id;
                let matches = await readCollection({}, 'match')
                    .then(data => {
                        return data;
                    })
                    .catch(err => {
                        console.error(err);
                    });
                for (let m of matches) {
                    if ((m.p1_id == pid2 || m.p2_id == pid2) && m.ended_at == null) {
                        already_active = true;
                    }
                }
    
                if ("entry_fee_usd" in qs) {
                    let splitFee = qs.entry_fee_usd.split('.');
                    if (splitFee.length == 2) {
                        let numDec = splitFee[1].length;
                        if (numDec <= 2) {
                            entry_fee = parseFloat(qs.entry_fee_usd).toFixed(2).toString();
                            let p2balance = check[0].balance_usd;
                            if (parseFloat(p2balance, 10) < parseFloat(entry_fee, 10)) {
                                sufficient_balance = false;
                            } else {
                                let tmp = parseFloat(p2balance, 10) - parseFloat(entry_fee, 10);
                                newBalance2 = tmp.toFixed(2);
                            }
                        }
                    } else if (splitFee.length == 1) {
                        entry_fee = parseFloat(qs.entry_fee_usd).toFixed(2).toString();
                        let p2balance = check[0].balance_usd;
                        if (parseFloat(p2balance, 10) < parseFloat(entry_fee, 10)) {
                            sufficient_balance = false;
                        } else {
                            let tmp = parseFloat(p2balance, 10) - parseFloat(entry_fee, 10);
                            newBalance2 = tmp.toFixed(2);
                        }
                    }
                }
            }
        }

        let success = false;
        if ((typeof pid1 != "undefined" && typeof pid2 != "undefined") && !already_active && sufficient_balance && prize_usd.length > 0 && entry_fee.length > 0) {
            success = true;
        }

        if (!sufficient_balance && (prize_usd.length == 0 || entry_fee.length == 0)) {
            sufficient_balance = true;
            success = false;
        }

        if (typeof pid1 == "undefined" || typeof pid2 == "undefined") {
            res.status(404);
            res.end();
        } else if (already_active) {
            res.status(409);
            res.end();
        } else if (!sufficient_balance) {
            res.status(402);
            res.end();
        } else if (success) {
            let temp_obj = {
                created_at: new Date,
                ended_at: null,
                entry_fee_usd: entry_fee,
                is_dq: false,
                p1_id: pid1,
                p1_points: 0,
                p2_id: pid2,
                p2_points: 0,
                prize_usd: prize_usd
            };

            let objectId = await insertIntoCollection(temp_obj, 'match')
                .then(data => {
                    return data;
                })
                .catch(err => {
                    console.error(err);
                });
            
            let query1 = {"_id": {$in: [ObjectId(pid1)]}};
            let p1 = await readCollection(query1, 'player')
                .then(data => {
                    return data;
                })
                .catch(err => {
                    console.error(err);
                });
            p1[0].balance_usd = newBalance1;
            p1[0].in_active_match = objectId;

            let query2 = {"_id": {$in: [ObjectId(pid2)]}};
            let p2 = await readCollection(query2, 'player')
                .then(data => {
                    return data;
                })
                .catch(err => {
                    console.error(err);
                });
            p2[0].balance_usd = newBalance2;
            p2[0].in_active_match = objectId;
            
            let newValues1 = { $set: p1[0]};
            const result1 = mongoDb.collection('player').updateOne({"_id": ObjectId(pid1)}, newValues1);

            let newValues2 = { $set: p2[0]};
            const result2 = mongoDb.collection('player').updateOne({"_id": ObjectId(pid2)}, newValues2);

            res.redirect(303, `/match/${objectId}`);
            res.end();
        } else {
            res.status(400);
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
        let players = await readCollection({}, 'player')
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

app.post('/match/:mid/award/:pid', async (req, res, next) => {
    try {
        let qs = req.query;
        let player = undefined;
        let match = undefined
        if (ObjectId.isValid(req.params.pid)) {
            let player_query = {"_id": {$in: [ObjectId(req.params.pid)]}};
            player = await readCollection(player_query, 'player')
                .then(data => {
                    return data;
                })
                .catch(err => {
                    console.error(err);
                });
        }

        if (ObjectId.isValid(req.params.mid)) {
            let match_query = {"_id": {$in: [ObjectId(req.params.mid)]}};
            match = await readCollection(match_query, 'match')
                .then(data => {
                    return data;
                })
                .catch(err => {
                    console.error(err);
                });
        }

        let error = false;
        let in_match = true;
        let active = true;
        let p1_id = undefined;
        let p2_id = undefined;

        if (typeof match != "undefined") {
            p1_id = match[0].p1_id;
            p2_id = match[0].p2_id;
        }

        if (typeof player == "undefined" || typeof match == "undefined") {
            error = true;
        } else if (player.length == 0 || match.length == 0) {
            error = true;
        } else {
            if (p1_id != req.params.pid && p2_id != req.params.pid) {
                in_match = false;
            }

            if (match[0].ended_at != null) {
                active = false;
            }
        }

        let points = 0;
        if ("points" in qs) {
            if (Number.isInteger(Number(qs.points)) && qs.points.match(/^[0-9]+$/) != null) {
                if (Number(qs.points) > 0) {
                    points = qs.points;
                }
            }
        }

        let p1_points = 0
        if (!error) {
            if ("p1_points" in match[0]) {
                if (typeof match[0].p1_points != "undefined") {
                    p1_points = match[0].p1_points;
                }
            }
        }

        let p2_points = 0
        if (!error) {
            if ("p2_points" in match[0]) {
                if (typeof match[0].p2_points != "undefined") {
                    p2_points = match[0].p2_points;
                }
            }
        }

        let success = (points != 0) && !error && active && in_match;

        if (error) {
            res.status(404);
            res.end();
        } else if (!active) {
            res.status(409);
            res.end();
        } else if (success) {
            match[0].p1_points = p1_points;
            match[0].p2_points = p2_points;
            if (p1_id == req.params.pid) {
                match[0].p1_points += parseInt(points);
            } else {
                match[0].p2_points += parseInt(points);
            }

            let newValues = { $set: match[0]};
            const result = mongoDb.collection('match').updateOne({"_id": match[0]._id}, newValues);

            let desiredMatch = match[0];
            let query1 = {"_id": {$in: [ObjectId(desiredMatch.p1_id)]}};
            let player1 = await readCollection(query1, 'player')
                .then(data => {
                    return data;
                })
                .catch(err => {
                    console.error(err);
                });

            let query2 = {"_id": {$in: [ObjectId(desiredMatch.p2_id)]}};
            let player2 = await readCollection(query2, 'player')
                .then(data => {
                    return data;
                })
                .catch(err => {
                    console.error(err);
                });
            let formatDesiredMatch = formatMatch(desiredMatch, player1[0], player2[0]);
            res.status(200).json(formatDesiredMatch);
            res.end();
        } else {
            res.status(400);
            res.end();
        }
    } catch (err) {
        return next(err);
    }

    next();
});

app.post('/match/:mid/end', async (req, res, next) => {
    try {
        let match = undefined;
        if (ObjectId.isValid(req.params.mid)) {
            let match_query = {"_id": {$in: [ObjectId(req.params.mid)]}};
            match = await readCollection(match_query, 'match')
                .then(data => {
                    return data;
                })
                .catch(err => {
                    console.error(err);
                });
        }

        let exists = true;
        let active = true;
        let tied = false;
        let winner = 0;
        if (typeof match == "undefined") {
            exists = false;
        } else if (match.length == 0) {
            exists = false;
        } else {
            if (match[0].ended_at != null) {
                active = false;
            }

            if (match[0].p1_points < match[0].p2_points) {
                winner = 2;
            } else if (match[0].p1_points > match[0].p2_points) {
                winner = 1;
            } else {
                tied = true;
            }
        }

        if (!exists) {
            res.status(404);
            res.end();
        } else if (!active || tied) {
            res.status(409);
            res.end();
        } else {
            match[0].ended_at = new Date;
            let newValues = { $set: match[0]};
            const resultm = mongoDb.collection('match').updateOne({"_id": match[0]._id}, newValues);

            let desiredMatch = match[0];
            let query1 = {"_id": {$in: [ObjectId(desiredMatch.p1_id)]}};
            let player1 = await readCollection(query1, 'player')
                .then(data => {
                    return data;
                })
                .catch(err => {
                    console.error(err);
                });

            player1[0].in_active_match = null;
            
            if ("num_join" in player1[0]) {
                if (typeof player1[0].num_join != "undefined") {
                    player1[0].num_join += 1
                } else {
                    player1[0].num_join = 1;
                }
            } else {
                player1[0].num_join = 1;
            }

            let query2 = {"_id": {$in: [ObjectId(desiredMatch.p2_id)]}};
            let player2 = await readCollection(query2, 'player')
                .then(data => {
                    return data;
                })
                .catch(err => {
                    console.error(err);
                });

            player2[0].in_active_match = null;

            
            if ("num_join" in player2[0]) {
                if (typeof player2[0].num_join != "undefined") {
                    player2[0].num_join += 1
                } else {
                    player2[0].num_join = 1;
                }
            } else {
                player2[0].num_join = 1;
            }
            
            if (winner == 1) {
                if ("num_won" in player1[0]) {
                    if (typeof player1[0].num_won != "undefined") {
                        player1[0].num_won += 1
                    } else {
                        player1[0].num_won = 1;
                    }
                } else {
                    player1[0].num_won = 1;
                }
                player1[0].efficiency = player1[0].num_won/player1[0].num_join;
                let tmp = parseFloat(player1[0].balance_usd, 10);
                player1[0].balance_usd = (tmp + parseFloat(desiredMatch.prize_usd, 10)).toFixed(2);
            } else {
                if ("num_won" in player2[0]) {
                    if (typeof player2[0].num_won != "undefined") {
                        player2[0].num_won += 1
                    } else {
                        player2[0].num_won = 1;
                    }
                } else {
                    player2[0].num_won = 1;
                }
                player2[0].efficiency = player2[0].num_won/player2[0].num_join;
                let tmp = parseFloat(player2[0].balance_usd, 10);
                player2[0].balance_usd = (tmp + parseFloat(desiredMatch.prize_usd, 10)).toFixed(2);
            }

            let newValuesp1 = { $set: player1[0]};
            const resultp1 = mongoDb.collection('player').updateOne({"_id": player1[0]._id}, newValuesp1);

            let newValuesp2 = { $set: player2[0]};
            const resultp2 = mongoDb.collection('player').updateOne({"_id": player2[0]._id}, newValuesp2);

            let formatDesiredMatch = formatMatch(desiredMatch, player1[0], player2[0]);
            res.status(200).json(formatDesiredMatch);
            res.end();
        }
    } catch (err) {
        return next(err);
    }

    next();
});

app.post('/match/:mid/disqualify/:pid', async (req, res, next) => {
    try {
        let player = undefined;
        let match = undefined;

        if (ObjectId.isValid(req.params.pid) && ObjectId.isValid(req.params.mid)) {
            let player_query = {"_id": {$in: [ObjectId(req.params.pid)]}};
            let match_query = {"_id": {$in: [ObjectId(req.params.mid)]}};
            player = await readCollection(player_query, 'player')
                .then(data => {
                    return data;
                })
                .catch(err => {
                    console.error(err);
                });

            match = await readCollection(match_query, 'match')
                .then(data => {
                    return data;
                })
                .catch(err => {
                    console.error(err);
                });
        }

        let error = false;
        let in_match = true;
        let active = true;
        let dq = 0;
        if (typeof player == "undefined" || typeof match == "undefined") {
            error = true;
        } else if (player.length == 0 || match.length == 0) {
            error = true;
        } else {
            let p1_id = match[0].p1_id;
            let p2_id = match[0].p2_id;

            if (p1_id == req.params.pid) {
                dq = 1;
            } else {
                dq = 2;
            }

            if (p1_id != req.params.pid && p2_id != req.params.pid) {
                in_match = false;
            }

            if (match[0].ended_at != null) {
                active = false;
            }
        }

        if (error) {
            res.status(404);
            res.end();
        } else if (!active) {
            res.status(409);
            res.end();
        } else if (in_match) {
            match[0].is_dq = true;
            if (dq == 1) {
                match[0].p1_points = 0;
                match[0].p2_points = 1;
            } else {
                match[0].p1_points = 1;
                match[0].p2_points = 0;
            }
            match[0].ended_at = new Date();
            let newValues_match = { $set: match[0]};
            const match_result = mongoDb.collection('match').updateOne({"_id": match[0]._id}, newValues_match);

            let desiredMatch = match[0];
            let query1 = {"_id": {$in: [ObjectId(desiredMatch.p1_id)]}};
            let player1 = await readCollection(query1, 'player')
                .then(data => {
                    return data;
                })
                .catch(err => {
                    console.error(err);
                });

            if ("num_join" in player1[0]) {
                if (typeof player1[0].num_join != "undefined") {
                    player1[0].num_join += 1
                } else {
                    player1[0].num_join = 1;
                }
            } else {
                player1[0].num_join = 1;
            }
            
            let query2 = {"_id": {$in: [ObjectId(desiredMatch.p2_id)]}};
            let player2 = await readCollection(query2, 'player')
                .then(data => {
                    return data;
                })
                .catch(err => {
                    console.error(err);
                });

            if ("num_join" in player1[0]) {
                if (typeof player1[0].num_join != "undefined") {
                    player1[0].num_join += 1
                } else {
                    player1[0].num_join = 1;
                }
            } else {
                player1[0].num_join = 1;
            }
            
            if (dq == 1) {
                if ("num_dq" in player1[0]) {
                    if (typeof player1[0].num_dq != "undefined") {
                        player1[0].num_dq += 1
                    } else {
                        player1[0].num_dq = 1;
                    }
                } else {
                    player1[0].num_dq = 1;
                }

                if ("num_won" in player1[0]) {
                    if (typeof player1[0].num_won == "undefined") {
                        player1[0].num_won = 0
                    }
                } else {
                    player1[0].num_won = 0;
                }

                if ("num_won" in player2[0]) {
                    if (typeof player2[0].num_won != "undefined") {
                        player2[0].num_won += 1
                    } else {
                        player2[0].num_won = 1;
                    }
                } else {
                    player2[0].num_won = 1;
                }

                player1[0].efficiency = player1[0].num_won/player1[0].num_join;
                player2[0].efficiency = player2[0].num_won/player2[0].num_join;
                let tmp = parseFloat(player2[0].balance_usd, 10);
                player2[0].balance_usd = (tmp + parseFloat(desiredMatch.prize_usd, 10)).toFixed(2);
            } else {
                if ("num_dq" in player2[0]) {
                    if (typeof player2[0].num_dq != "undefined") {
                        player2[0].num_dq += 1
                    } else {
                        player2[0].num_dq = 1;
                    }
                } else {
                    player2[0].num_dq = 1;
                }

                if ("num_won" in player2[0]) {
                    if (typeof player2[0].num_won == "undefined") {
                        player2[0].num_won = 0
                    }
                } else {
                    player2[0].num_won = 0;
                }

                if ("num_won" in player1[0]) {
                    if (typeof player1[0].num_won != "undefined") {
                        player1[0].num_won += 1
                    } else {
                        player1[0].num_won = 1;
                    }
                } else {
                    player1[0].num_won = 1;
                }

                player1[0].efficiency = player1[0].num_won/player1[0].num_join;
                player2[0].efficiency = player2[0].num_won/player2[0].num_join;
                let tmp = parseFloat(player1[0].balance_usd, 10);
                player1[0].balance_usd = (tmp + parseFloat(desiredMatch.prize_usd, 10)).toFixed(2);
            }

            let newValues_player1 = { $set: player1[0]};
            const player_result1 = mongoDb.collection('player').updateOne({"_id": player1[0]._id}, newValues_player1);

            let newValues_player2 = { $set: player2[0]};
            const player_result2 = mongoDb.collection('player').updateOne({"_id": player2[0]._id}, newValues_player2);
            
            let formatDesiredMatch = formatMatch(desiredMatch, player1[0], player2[0]);
            res.status(200).json(formatDesiredMatch);
            res.end();
        } else if (!in_match) {
            res.status(400);
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
        let players = await readCollection({}, 'player')
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