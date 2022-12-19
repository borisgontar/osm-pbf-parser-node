declare module 'osm-pbf-parser-node' {

    import { Transform, TransformOptions } from 'node:stream';

    type WithTags = boolean | string[];

    export interface OSMOptions {
        withTags?: boolean | {node?: WithTags, way?: WithTags, relation?: WithTags},
        withInfo?: boolean,
        syncMode?: boolean
    };

    export class OSMTransform extends Transform {
        constructor(osmopts?: OSMOptions, opts?: TransformOptions);
    }

    export async function* createOSMStream(file: string, opts?: OSMOptions): void;
}
