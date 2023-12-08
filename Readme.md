# osm-pbf-parser-node

Streaming [OpenStreetMap PBF](https://wiki.openstreetmap.org/wiki/PBF_Format) parser

This Node.js module reads a stream in osm.pbf format and transforms it
into a readable stream of OSM entities (header, nodes, ways and relations).

The module uses (more or less) recent Javascript features, like
the nullish coalescing (??) operator, so it will not work with
older versions of Node.js. Works for me on version 16.13.

## Example

```javascript
import { createOSMStream } from 'osm-pbf-parser-node';
for await (let item of createOSMStream('path-to-file.osm.pbf'))
    console.log(item);
```
The output will look like the following.

The OSM Header block:
```javascript
{
  bbox: { left: -95159650000, right: -74309980000, top: 57508260000, bottom: 41637700000 },
  required_features: [ 'OsmSchema-V0.6', 'DenseNodes' ],
  optional_features: [],
  writingprogram: 'osmium/1.14.0',
  source: '',
  osmosis_replication_timestamp: 1658434914,
  osmosis_replication_sequence_number: 3403,
  osmosis_replication_base_url: 'http://download.geofabrik.de/north-america/canada/ontario-updates'
}
```
For every node:
```javascript
{
    "type":"node",
    "id":3406566,
    "lat":35.3320358,
    "lon":33.330649,
    "tags": {
        "highway":"traffic_signals",
        "is_in":"Ozanköy; Girne; Kuzey Kıbrıs Türk Cumhuriyeti"
    },
    "info": {
        "version":30,
        "timestamp":"2021-11-29T20:15:45Z",
        "changeset":nnnnn,
        "uid":nnnnn,
        "user":"xxxxx"
    }
}
```

For every way:
```javascript
{
    "type":"way",
    "id":3990794,
    "refs":[20883417,5028923737,5028923736, ...],
    "tags":{
        "man_made":"breakwater"
    },
    "info":{ ... }
}
```

For every relation:
```javascript
{
    "type":"relation",
    "id":69898,
    "members":[
        {"type":"node","ref":268094888,"role":"via"},
        {"type":"way","ref":24665096,"role":"to"},
        {"type":"way","ref":708939399,"role":"from"}
    ],
    "tags":{
        "restriction":"no_right_turn","type":"restriction"
    }
    "info":{ ... }
}
```
The properties `tags` and `info` are optional.
The `info` fields are similar for all three object types.
Also, according to https://download.geofabrik.de/technical.html, the metadata
fields `info.user`, `info.uid` and `info.changeset`
are removed from public osm.pbf downloads since May 2018.

## Installation

```bash
npm install osm-pbf-parser-node
```

## Usage

The module exports an async generator function:
```javascript
export async function* createOSMStream(file: string, opts?: OSMOptions):
    AsyncGenerator<object, void, unknown>;
```
The arguments are path to the input file in the osm.pbf format
and an object with the following properties:

* `withTags` - whether to include (and which) tags into the output.
Can be a boolean, or an object {node: _what_, way: _what_, relation: _what_},
where each _what_ is in turn either `true` (the default) or `false` or an array
of tag keys to include. In the latter case all other tags are
not included, so `withTags.node == []` is the same as `withTags.node = false`.

* `withInfo` - whether to include metadata information into output.

* `writeRaw` - if `true`, send raw OSMData block to the output, see an example below.

The defaults are:
```javascript
{ withTags: true, withInfo: false, writeRaw: false }
```

The module also exports the OSMTransform class:
```javascript
import { Transform } from 'node:stream';
export class OSMTransform extends Transform {
    constructor(osmopts?: OSMOptions, opts?: TransformOptions);
}
```
This class can be used in a chain of pipes like this:
```javascript
new Promise(resolve => {
    createReadStream('path-to-file.osm.pbf')
        .pipe(new OSMTransform(osmopts))
        .pipe(consume)
        .on('finish', resolve);
});

```
where `consume` is the next Writable. For example,
the following code just prints out all received objects:
```javascript
const consume = new Transform.PassThrough({
    objectMode: true,
    transform: (items, enc, next) => {
        for (let item of items)
            console.log(item);
        next();
    }
});
```
Note that the Writable side always receives arrays of items.
The length of such arrays can vary from 1 (e.g. for OSMHeader)
to several thousands. The order of items in the output is always
the same as the order in the input stream.

The following example shows how to use OSMTransform for reading directly from an URL:
```javascript
import { get as http_get } from 'node:http';
new Promise((resolve, reject) => {
    http_get(url, res => {
        if (res.statusCode != 200) {
            console.log(`got status code ${res.statusCode} ${res.statusMessage}`);
            return reject('request failed');
        }
        res.pipe(new OSMTransform(osmopts))
            .pipe(consume)
            .on('finish', resolve);
    });
});
```
See file `test.js` for a complete example.

## Raw output

If `writeRaw` is `true`, OSMTransform pushes compressed OSMData blocks
into output. In this case the next Writable in the pipeline should
inflate the data blocks and call `parse` to convert them into an array
of nodes, etc. The package export this function as:
```javascript
export function parse(osmdata: Buffer, options: OSMTransform|OSMOptions): Array<object>;
```

 For example:
```javascript
new Promise(resolve => {
    createReadStream(file)
        .pipe(new OSMTransform({writeRaw: true}))
        .pipe(rawWritable)
        .on('finish', resolve)
        .on('error', e => console.error(e));
});
```
where the RawWritable class does the job:
```javascript
const rawWritable = new Writable({
    objectMode: true,
    write(chunk, enc, next) {
        if (chunk instanceof Buffer) {
            let buf = inflateSync(chunk);
            let batch = parse(buf, {withTags: true, withInfo: false});
            // ... do something with batch
        } else
            // chunk[0] contains OSM Header
        next();
    }
});
```

## Performance

The script `test.js` does nothing but counts nodes, ways and relations
in the input stream. Here is the speed of parsing canada-latest.osm.pbf
as of Nov. 2022, about 2.75 GB in size, using OSMTransform with
withTags=true, withInfo=false:

* on ASUS StudioBook (i7-9750H, DDR4-2666): 2m50s, about 2.37 millions items per second.

* on Intel NUC-12 (i9-12900, DDR4-3200, NVMe SSD): 1m55s, about 3.5
millions items per second.

For some reason parsing of really big files is slower. Parsing 67GB of
planet-latest.osm.pbf took 1h22m (1.8 millions items per second) on NUC-12.

The speed of createOSMStream is about 1.6 times lower, apparently because it executes
`yield` millions of times.


## Limitations

The OSMData blocks are supposed to be inflatable by `inflate` from `node:zlib`,
the compressed data in `zlib_data`. Other compression methods are not
implemented.

## Notes

This module uses the synchronous `inflateSync` from `node:zlib`.
The asynchronous `inflate` may result in a better speed, but
I haven't seen more that 10% faster. On the other hand it
uses considerably more memory. To my opinion, using the `writeRaw` mode
and worker threads on the Writable side leads to much better results.

The proto files have been updated from
https://github.com/openstreetmap/OSM-binary/tree/master/osmpbf
and compiled by the [Mapbox pbf compiler](https://github.com/mapbox/pbf).
