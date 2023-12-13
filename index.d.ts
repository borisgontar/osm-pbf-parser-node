declare module 'osm-pbf-parser-node' {

    import { Transform, TransformOptions } from 'node:stream';

    type WithTags = boolean | string[];

    export interface OSMOptions {
        withTags?: boolean | {node?: WithTags, way?: WithTags, relation?: WithTags},
        withInfo?: boolean,
        writeRaw?: boolean
    };

    export class OSMTransform extends Transform {
        constructor(osmopts?: OSMOptions, opts?: TransformOptions);
    }

    export function* createOSMStream(file: string, opts?: OSMOptions):
	    AsyncGenerator<object, void, unknown>;

    export function parse(osmdata: Buffer, transform: OSMTransform|OSMOptions): Array<object>;
}
