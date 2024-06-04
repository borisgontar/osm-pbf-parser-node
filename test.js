import { createReadStream } from 'node:fs';
import { Transform, Writable } from 'node:stream';
import { createOSMStream, OSMTransform, parse } from './parser.js';
import { get as http_get } from 'node:http';
import { inflateSync } from 'node:zlib';

// feel free to change the following three settings

let file = '../data/cyprus-latest.osm.pbf';
let opts = {
    withInfo: false,
    withTags: true /*{
        node: ['name', 'amenity', 'shop'],
        way: [],
        relation: ['boundary']
    }*/
};

const usage = `
arg1 = 1: test OSMTransform
       2: test createOSMStream
       3: test http get
       4: test writeRaw
       0: print everything out,
arg2 = file name or URL.
`;

let n = 0, w = 0, r = 0;

function header(item) {
    let seqno = item.osmosis_replication_sequence_number,
        url = item.osmosis_replication_base_url,
        tms = item.osmosis_replication_timestamp;
    let str = new Date(tms * 1000).toUTCString().substring(5);
    console.log(`header: seqno: ${seqno}, timestamp: ${str}, url: ${url}`);
}

function count(item) {
    if (item.type == 'node')
        ++n;
    else if (item.type == 'way')
        ++w;
    else if (item.type == 'relation')
        ++r;
    else if (item.bbox)
        header(item);
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

const rawWritable = new Writable({
    objectMode: true,
    write(chunk, enc, next) {
        if (chunk instanceof Buffer) {
            let buf = inflateSync(chunk);
            let batch = parse(buf, opts.withTags);
            for (let item of batch)
                count(item);
        } else
            header(chunk[0]);
        next();
    }
});

// test OSMTransform
async function test1() {
    console.log(`reading from ${file}`);
    console.log(`withInfo: ${opts.withInfo}, ` +
        `withTags: ${JSON.stringify(opts.withTags)}`)
    return new Promise(resolve => {
        createReadStream(file)
            .pipe(new OSMTransform(opts))
            .pipe(final)
            .on('finish', resolve)
            .on('error', e => console.error(e));
    });
}

// test createOSMStream
async function test2() {
    console.log(`reading from ${file}`);
    console.log(`withInfo: ${opts.withInfo}, ` +
        `withTags: ${JSON.stringify(opts.withTags)}`)
    for await (let item of createOSMStream(file, opts)) {
        count(item);
    }
}

// test http get
async function test3() {
    console.log(`reading from ${file}`);
    console.log(`withInfo: ${opts.withInfo}, ` +
        `withTags: ${JSON.stringify(opts.withTags)}`)
    return new Promise((resolve, reject) => {
        http_get(file, res => {
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

// test writeRaw
async function test4() {
    console.log(`reading from ${file} in raw mode`);
    return new Promise(resolve => {
        createReadStream(file)
            .pipe(new OSMTransform({ writeRaw: true }))
            .pipe(rawWritable)
            .on('finish', resolve)
            .on('error', e => console.error(e));
    });
}

// print out everything
async function test0() {
    const opts0 = { withInfo: true, withTags: true };
    for await (let item of createOSMStream(file, opts0)) {
        process.stdout.write(JSON.stringify(item) + '\n');
    }
}

let arg = Number(process.argv[2]);
if (!Number.isInteger(arg) || arg < 0 || arg > 4) {
    process.stderr.write(usage);
    process.exit(1);
}
if (!(file = process.argv[3])) {
    process.stderr.write(usage);
    console.log('Please specify ' + (arg == 3 ? 'URL' : 'file name'));
    process.exit(1);
}

const proc = [test0, test1, test2, test3, test4];

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
