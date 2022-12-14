# osm-pbf-parser-node

Streaming [OpenStreetMap PBF](https://wiki.openstreetmap.org/wiki/PBF_Format) parser

This Node.js module reads a writable stream in osm.pbf format and transforms it
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
* The OSM Header block:
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
* For every node:
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

* For every way:
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

* For every relation:
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
export async function* createOSMStream(file: string, opts?: OSMOptions): void;
```
The arguments are path to the input file in the osm.pbf format
and an object with the following properties:

`withTags` - whether to include tags into the output

`withInfo` - whether to include metadata information into output

The defaults are:
```javascript
{ withTags: true, withInfo: false }
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
where `consume` is the final Writable. For example,
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
to several thousands.

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

## Performance

The script `test.js` does nothing but counts nodes, ways and relations
in the input stream. Here is the output for canada-latest.osm.pbf
as of Nov. 2022, about 2.75 GB in size, on my ASUS StudioBook
(i7-9750H, DDR4-2666):

* using OSMTransform: 2m51s, about 2.36 millions items per second

* using createOSMStream: 4m35s, about 1.47 millions items per second

Apparenlty, the speed of createOSMStream is 1.6 times lower because it executes
`yield` millions of times.

## Notes

The proto files have been updated from
https://github.com/openstreetmap/OSM-binary/tree/master/osmpbf
and compiled by the [Mapbox pbf compiler](https://github.com/mapbox/pbf).
