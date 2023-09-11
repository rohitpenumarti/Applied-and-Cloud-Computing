'use strict';

const fs = require('fs');

async function filesExists(file1, file2) {
    try {
        fs.stat(file1, (error, stats) => {
            if (!error) {
                f1 = true;
            }
        });

        fs.stat(file2, (error, stats) => {
            if (!error) {
                f2 = true;
            }
        });

        if (f1 && f2) {
            return true;
        } else if (f1 && !f2) {
            throw new Error('file2 not exist');
        } else if (!f1 && f2) {
            throw new Error("file1 not exist");
        } else {
            throw new Error('file and file2 not exist');
        }
    } catch (err) {
        console.error(err);
    }
}

async function readFiles(file1, file2) {
    try {
        if (filesExists(file1, file2)) {
            fs.readFile(file1, (err, data) => {
                if (err) {
                    console.error('Failed file1 read.');
                } else {
                    res.push(data);
                }
            });

            fs.readFile(file2, (err, data) => {
                if (err) {
                    console.error('Failed file1 read.');
                } else {
                    res.push(data);
                }
            })
        }
    } catch (err) {
        console.error(err);
    }

    return res;
}

exports.fileCat = function(file1, file2, callback) {
    this.SEPARATOR = ' ';
    this.TIMEOUT_MS = 2000;

    let timer = setTimeout(() => {
        console.log("runs after two seconds");
    }, this.TIMEOUT_MS);
}