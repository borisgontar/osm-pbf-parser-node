declare module 'osm-pbf-parser-node' {

    import { Transform, TransformOptions } from 'node:stream';

    export interface OSMOptions {
        withTags?: boolean,
        withInfo?: boolean
    };

    export class OSMTransform extends Transform {
        constructor(osmopts?: OSMOptions, opts?: TransformOptions);
    }

    export async function* createOSMStream(file: string, opts?: OSMOptions): void;
}
