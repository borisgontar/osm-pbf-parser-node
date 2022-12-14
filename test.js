import { createReadStream } from 'node:fs';
import { Transform } from 'node:stream';
import { createOSMStream, OSMTransform } from './parser.js';
import { get as http_get } from 'node:http';

// feel free to change the following three lines

const file = '../data/canada-latest.osm.pbf';
const url = 'http://download.geofabrik.de/europe/cyprus-latest.osm.pbf';
const opts = {
    withInfo: false,
    withTags: true
};

const usage = `
arg = 1: test OSMTransform
      2: test createOSMStream
      3: test http get
      0: print everything out
`;

let n = 0, w = 0, r = 0;

function count(item) {
    if (item.type == 'node')
        ++n;
    else if (item.type == 'way')
        ++w;
    else if (item.type == 'relation')
        ++r;
    else if (item.bbox)
        console.log('header');
    else
        console.log('bug');
}

const final = new Transform.PassThrough({
    objectMode: true,
    transform: (items, enc, next) => {
        for (let item of items)
            count(item);
        next();
    }
});

// test OSMTransform
async function proc1() {
    console.log(`reading from ${file}\nwithInfo: ${opts.withInfo}, ` +
        `withTags: ${opts.withTags}`);
    return new Promise(resolve => {
        createReadStream(file)
            .pipe(new OSMTransform(opts))
            .pipe(final)
            .on('finish', resolve)
            .on('error', e => console.error(e));
    });
}

// test createOSMStream
async function proc2() {
    console.log(`reading from ${file}\nwithInfo: ${opts.withInfo}, ` +
        `withTags: ${opts.withTags}`);
    for await (let item of createOSMStream(file, opts)) {
        count(item);
    }
}

// test http get
async function proc3() {
    console.log(`reading from ${url}\nwithInfo: ${opts.withInfo}, ` +
        `withTags: ${opts.withTags}`);
    return new Promise((resolve, reject) => {
        http_get(url, res => {
            if (res.statusCode != 200) {
                console.log(`got status code ${res.statusCode} ${res.statusMessage}`);
                return reject('request failed');
            }
            res.pipe(new OSMTransform(opts))
                .pipe(final)
                .on('finish', resolve);
        });

    });
}

// print out everything
async function proc0() {
    const opts0 = { withInfo: true, withTags: true };
    for await (let item of createOSMStream(file, opts0)) {
        process.stdout.write(JSON.stringify(item) + '\n');
    }
}

let arg = Number(process.argv[2]);
if (!Number.isInteger(arg) || arg < 0 || arg > 3) {
    process.stderr.write(usage);
    process.exit(1);
}

const proc = [proc0, proc1, proc2, proc3];

try {
    if (arg > 0)
        console.time('elapsed');
    let time = Date.now();
    await proc[arg]();
    if (arg > 0)
        console.log(`counted: ${n} nodes, ${w} ways, ${r} relations`);
    time = (Date.now() - time) * 0.001;   //sec
    let ips = (n + w + r) / time;
    if (arg > 0) {
        console.log(`         ${ips.toFixed(0)} items/sec.`);
        console.timeEnd('elapsed');
    }
} catch (err) {
    process.stderr.write(err.message || err);
}
